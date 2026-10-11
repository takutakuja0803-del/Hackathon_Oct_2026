import type { ParsedFunction, ParsedStatement } from './types.ts';

interface ActiveVar {
  name: string;
  type: string;
  role: 'local' | 'parameter';
  isReference?: boolean;
  refTargetName?: string;
  isArray?: boolean;
  arrayExtent?: number;
}

export function generateInstrumentedCode(functions: ParsedFunction[]): { code: string } {
  const parts: string[] = ['#include "runtime.hpp"\n'];

  // Instrument non-main functions first, then main()
  const nonMainFns = functions.filter((f) => f.name !== 'main');
  const mainFn = functions.find((f) => f.name === 'main');

  for (const fn of nonMainFns) {
    parts.push(instrumentFunction(fn, false));
    parts.push('');
  }

  if (mainFn) {
    parts.push(instrumentFunction(mainFn, true));
  }

  return { code: parts.join('\n') };
}

function instrumentFunction(fn: ParsedFunction, isMain: boolean): string {
  const activeVars: ActiveVar[] = [];

  // Register parameters as active variables
  for (const p of fn.parameters) {
    activeVars.push({
      name: p.name,
      type: p.type,
      role: 'parameter',
    });
  }

  const paramSignature = fn.parameters
    .map((p) => `${p.type} ${p.name}`)
    .join(', ');

  const bodyLines: string[] = [];

  if (isMain) {
    bodyLines.push('    vgdb::TracerGuard _vgdb_guard;');
    bodyLines.push(`    vgdb::Tracer::instance().push_frame("main", ${fn.startLine}, {});`);
  } else {
    const paramInits = activeVars.map(generateVarInit);
    bodyLines.push(
      `    vgdb::Tracer::instance().push_frame("${escapeCpp(fn.name)}", ${fn.startLine}, {\n        ${paramInits.join(',\n        ')}\n    });`
    );
  }

  let hasExplicitReturn = false;

  for (const stmt of fn.statements) {
    if (stmt.kind === 'declaration') {
      if (stmt.varName && stmt.varType) {
        if (!activeVars.some((v) => v.name === stmt.varName)) {
          activeVars.push({
            name: stmt.varName,
            type: stmt.varType,
            role: 'local',
          });
        }
      }
      bodyLines.push(`    ${stmt.rawText}`);
      bodyLines.push(generateStepCall(stmt.line, stmt.description, activeVars));
    } else if (stmt.kind === 'reference_declaration') {
      if (stmt.varName && stmt.refTargetName) {
        if (!activeVars.some((v) => v.name === stmt.varName)) {
          activeVars.push({
            name: stmt.varName,
            type: 'int&',
            role: 'local',
            isReference: true,
            refTargetName: stmt.refTargetName,
          });
        }
      }
      bodyLines.push(`    ${stmt.rawText}`);
      bodyLines.push(generateStepCall(stmt.line, stmt.description, activeVars));
    } else if (stmt.kind === 'array_declaration') {
      if (stmt.varName && stmt.arrayExtent) {
        if (!activeVars.some((v) => v.name === stmt.varName)) {
          activeVars.push({
            name: stmt.varName,
            type: stmt.varType || `int[${stmt.arrayExtent}]`,
            role: 'local',
            isArray: true,
            arrayExtent: stmt.arrayExtent,
          });
        }
      }
      bodyLines.push(`    ${stmt.rawText}`);
      bodyLines.push(generateStepCall(stmt.line, stmt.description, activeVars));
    } else if (
      stmt.kind === 'assignment' ||
      stmt.kind === 'deref_assignment' ||
      stmt.kind === 'array_assignment' ||
      stmt.kind === 'expression'
    ) {
      bodyLines.push(`    ${stmt.rawText}`);
      bodyLines.push(generateStepCall(stmt.line, stmt.description, activeVars));
    } else if (stmt.kind === 'return') {
      hasExplicitReturn = true;
      if (isMain) {
        bodyLines.push('    vgdb::Tracer::instance().dump();');
      } else {
        bodyLines.push('    vgdb::Tracer::instance().pop_frame();');
      }
      bodyLines.push(`    ${stmt.rawText}`);
    }
  }

  if (!hasExplicitReturn) {
    if (!isMain) {
      bodyLines.push('    vgdb::Tracer::instance().pop_frame();');
    } else {
      bodyLines.push('    vgdb::Tracer::instance().dump();');
      bodyLines.push('    return 0;');
    }
  }

  return `${fn.returnType} ${fn.name}(${paramSignature}) {\n${bodyLines.join('\n')}\n}`;
}

function generateStepCall(line: number, description: string, activeVars: ActiveVar[]): string {
  const varInits = activeVars.map(generateVarInit);
  return `    vgdb::Tracer::instance().add_step(${line}, "${escapeCpp(
    description
  )}", {\n        ${varInits.join(',\n        ')}\n    });`;
}

function generateVarInit(v: ActiveVar): string {
  if (v.isArray && v.arrayExtent) {
    return `vgdb::make_var_array("${escapeCpp(v.name)}", "${escapeCpp(v.type)}", "${v.role}", ${v.name}, ${v.arrayExtent})`;
  }
  if (v.isReference && v.refTargetName) {
    return `vgdb::make_var_ref("${escapeCpp(v.name)}", "${escapeCpp(v.type)}", "${v.role}", ${v.name}, "${escapeCpp(v.refTargetName)}")`;
  }
  return `vgdb::make_var("${escapeCpp(v.name)}", "${escapeCpp(v.type)}", "${v.role}", ${v.name})`;
}

function escapeCpp(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
