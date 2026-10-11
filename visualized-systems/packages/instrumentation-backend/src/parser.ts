import type { ParsedFunction, ParsedStatement } from './types.ts';
import type { TraceDiagnostic } from '../../execution-trace/src/index.ts';

export interface ParseResult {
  success: boolean;
  functions: ParsedFunction[];
  mainFunction?: ParsedFunction;
  diagnostics: TraceDiagnostic[];
}

const UNSUPPORTED_KEYWORDS = [
  'class', 'struct', 'enum', 'union', 'template', 'typename',
  'namespace', 'using', 'typedef', 'virtual', 'override',
  'public', 'private', 'protected', 'try', 'catch', 'throw',
  'for', 'while', 'do', 'switch', 'case', 'goto', 'async',
  'thread', 'atomic', 'vector', 'map', 'set', 'string', 'iostream'
];

export function parseAndValidateSource(source: string): ParseResult {
  const diagnostics: TraceDiagnostic[] = [];
  const lines = source.split('\n');

  // Check overall size limit (safety: max 1000 lines, 64KB)
  if (lines.length > 1000 || source.length > 64 * 1024) {
    diagnostics.push({
      severity: 'error',
      code: 'source.size-limit',
      message: 'Source code exceeds maximum supported size (1000 lines or 64KB).',
      provenance: 'backend-inferred',
    });
    return { success: false, functions: [], diagnostics };
  }

  // Pre-check for unsupported keywords/constructs
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineText = lines[i].trim();

    // Skip empty lines and comments
    if (!lineText || lineText.startsWith('//') || lineText.startsWith('/*')) {
      continue;
    }

    for (const kw of UNSUPPORTED_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lineText)) {
        diagnostics.push({
          severity: 'error',
          code: 'syntax.unsupported',
          message: `This Live Visualizer currently supports basic variables, pointers, references, arrays, and functions. Unsupported construct found: '${kw}' at line ${lineNum}.`,
          provenance: 'backend-inferred',
        });
        return { success: false, functions: [], diagnostics };
      }
    }

    // Check for unsupported includes
    if (lineText.startsWith('#include')) {
      diagnostics.push({
        severity: 'error',
        code: 'syntax.unsupported-include',
        message: `Preprocessor directives (#include) are not needed for this live subset. Found at line ${lineNum}.`,
        provenance: 'backend-inferred',
      });
      return { success: false, functions: [], diagnostics };
    }
  }

  // Parse top-level functions
  const functions: ParsedFunction[] = [];
  let currentFn: ParsedFunction | null = null;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let lineText = lines[i];

    // Strip single-line comment
    const commentIdx = lineText.indexOf('//');
    if (commentIdx !== -1) {
      lineText = lineText.substring(0, commentIdx);
    }
    const trimmed = lineText.trim();
    if (!trimmed) continue;

    if (!currentFn) {
      // Look for function definition: e.g. int add(int a, int b) { or void swap(int* a, int* b) { or int main() {
      const fnHeaderMatch = trimmed.match(
        /^(int|void)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)\s*\{?/
      );
      if (fnHeaderMatch) {
        const returnType = fnHeaderMatch[1];
        const fnName = fnHeaderMatch[2];
        const rawParams = fnHeaderMatch[3].trim();

        const params: Array<{ name: string; type: string }> = [];
        if (rawParams && rawParams !== 'void') {
          const splitParams = rawParams.split(',').map((p) => p.trim());
          for (const sp of splitParams) {
            // int a, int* p, int& r
            const pMatch = sp.match(/^(int\s*\*?|int\s*&?)\s*([a-zA-Z_][a-zA-Z0-9_]*)$/);
            if (pMatch) {
              const pType = pMatch[1].replace(/\s+/g, '');
              const pName = pMatch[2];
              params.push({ name: pName, type: pType });
            } else {
              diagnostics.push({
                severity: 'error',
                code: 'syntax.unsupported-parameter',
                message: `Unsupported parameter declaration '${sp}' in function '${fnName}' at line ${lineNum}.`,
                provenance: 'backend-inferred',
              });
              return { success: false, functions: [], diagnostics };
            }
          }
        }

        currentFn = {
          name: fnName,
          returnType,
          parameters: params,
          startLine: lineNum,
          endLine: lineNum,
          statements: [],
        };

        braceCount = (trimmed.match(/\{/g) || []).length;
        continue;
      }
    } else {
      // Inside function body
      if (trimmed.includes('{')) {
        braceCount += (trimmed.match(/\{/g) || []).length;
      }
      if (trimmed.includes('}')) {
        braceCount -= (trimmed.match(/\}/g) || []).length;
        if (braceCount <= 0) {
          currentFn.endLine = lineNum;
          functions.push(currentFn);
          currentFn = null;
          braceCount = 0;
          continue;
        }
      }

      // Split line into statements by semicolon
      const rawStmts = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
      for (const stmt of rawStmts) {
        if (stmt === '{' || stmt === '}') continue;

        const parsed = parseStatement(stmt, lineNum);
        if (parsed.error) {
          diagnostics.push({
            severity: 'error',
            code: 'syntax.parse-error',
            message: `Unsupported or invalid statement at line ${lineNum}: "${stmt}". ${parsed.error}`,
            provenance: 'backend-inferred',
          });
          return { success: false, functions: [], diagnostics };
        }
        if (parsed.statement) {
          currentFn.statements.push(parsed.statement);
        }
      }
    }
  }

  const mainFunction = functions.find((f) => f.name === 'main');
  if (!mainFunction) {
    diagnostics.push({
      severity: 'error',
      code: 'syntax.missing-main',
      message: "Could not find 'int main()' function entry point in the source.",
      provenance: 'backend-inferred',
    });
    return { success: false, functions: [], diagnostics };
  }

  if (mainFunction.statements.length === 0) {
    diagnostics.push({
      severity: 'error',
      code: 'syntax.empty-main',
      message: "'int main()' does not contain any executable statements.",
      provenance: 'backend-inferred',
    });
    return { success: false, functions: [], diagnostics };
  }

  return {
    success: true,
    functions,
    mainFunction,
    diagnostics: [],
  };
}

function parseStatement(
  stmt: string,
  line: number
): { statement?: ParsedStatement; error?: string } {
  const clean = stmt.replace(/\s+/g, ' ').trim();

  // Return statement: return ...
  if (/^return\b/.test(clean)) {
    const expr = clean.replace(/^return\s*/, '').trim();
    return {
      statement: {
        kind: 'return',
        line,
        rawText: `${clean};`,
        expr,
        description: `Return ${expr || '0'}`,
      },
    };
  }

  // Reference declaration: int& r = x; or int &r = x;
  const refDeclMatch = clean.match(/^int\s*&\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (refDeclMatch) {
    const varName = refDeclMatch[1];
    const targetName = refDeclMatch[2];
    return {
      statement: {
        kind: 'reference_declaration',
        line,
        rawText: `${clean};`,
        varName,
        varType: 'int&',
        refTargetName: targetName,
        isReference: true,
        description: `Bound reference ${varName} = ${targetName}`,
      },
    };
  }

  // Fixed array declaration: int arr[3] = {1, 2, 3}; or int arr[3];
  const arrayDeclMatch = clean.match(/^int\s+([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\](?:\s*=\s*(\{[^}]*\}))?$/);
  if (arrayDeclMatch) {
    const varName = arrayDeclMatch[1];
    const extent = parseInt(arrayDeclMatch[2], 10);
    const initExpr = arrayDeclMatch[3];
    return {
      statement: {
        kind: 'array_declaration',
        line,
        rawText: `${clean};`,
        varName,
        varType: `int[${extent}]`,
        isArray: true,
        arrayExtent: extent,
        expr: initExpr,
        description: initExpr
          ? `Initialized ${varName}[${extent}] = ${initExpr}`
          : `Declared array ${varName}[${extent}]`,
      },
    };
  }

  // Array element assignment: arr[1] = 9;
  const arrayAssignMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]\s*=\s*(.+)$/);
  if (arrayAssignMatch) {
    const varName = arrayAssignMatch[1];
    const indexStr = arrayAssignMatch[2];
    const expr = arrayAssignMatch[3].trim();
    return {
      statement: {
        kind: 'array_assignment',
        line,
        rawText: `${clean};`,
        varName,
        arrayIndex: indexStr,
        expr,
        description: `Assigned ${varName}[${indexStr}] = ${expr}`,
      },
    };
  }

  // Pointer declaration: int* p = &x; or int *p = &x; or int* p;
  const ptrDeclMatch = clean.match(/^int\s*\*\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=\s*(.+))?$/);
  if (ptrDeclMatch) {
    const varName = ptrDeclMatch[1];
    const expr = ptrDeclMatch[2]?.trim();
    return {
      statement: {
        kind: 'declaration',
        line,
        rawText: `${clean};`,
        varName,
        varType: 'int*',
        expr,
        isPointer: true,
        description: expr ? `Initialized ${varName} = ${expr}` : `Declared pointer ${varName}`,
      },
    };
  }

  // Scalar int declaration: int x = 5; or int z = x + y; or int x;
  const scalarDeclMatch = clean.match(/^int\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=\s*(.+))?$/);
  if (scalarDeclMatch) {
    const varName = scalarDeclMatch[1];
    const expr = scalarDeclMatch[2]?.trim();
    return {
      statement: {
        kind: 'declaration',
        line,
        rawText: `${clean};`,
        varName,
        varType: 'int',
        expr,
        isPointer: false,
        description: expr ? `Initialized ${varName} = ${expr}` : `Declared ${varName}`,
      },
    };
  }

  // Pointer dereference assignment: *p = 10;
  const derefMatch = clean.match(/^\*\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
  if (derefMatch) {
    const varName = derefMatch[1];
    const expr = derefMatch[2].trim();
    return {
      statement: {
        kind: 'deref_assignment',
        line,
        rawText: `${clean};`,
        varName,
        expr,
        isPointer: true,
        description: `Assigned *${varName} = ${expr}`,
      },
    };
  }

  // Normal assignment: x = 10; or x = x + 1; or r = 20;
  const assignMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
  if (assignMatch) {
    const varName = assignMatch[1];
    const expr = assignMatch[2].trim();
    return {
      statement: {
        kind: 'assignment',
        line,
        rawText: `${clean};`,
        varName,
        expr,
        description: `Assigned ${varName} = ${expr}`,
      },
    };
  }

  // Expression statement: e.g. swap(&x, &y);
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\(.*\)$/.test(clean)) {
    return {
      statement: {
        kind: 'expression',
        line,
        rawText: `${clean};`,
        expr: clean,
        description: `Executed ${clean}`,
      },
    };
  }

  return {
    error: 'Only supported variable declarations, references, arrays, assignments, and returns are allowed in this live subset.',
  };
}
