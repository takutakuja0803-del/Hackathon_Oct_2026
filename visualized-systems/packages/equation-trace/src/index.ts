import {
  EQUATION_TRACE_VERSION,
  type EquationDiagnostic,
  type EquationStep,
  type EquationTrace,
  type CurveSnapshot,
} from './types.ts';
import { parseEquationLine } from './parser.ts';
import { evaluateAst, sampleCurve, type FunctionContext } from './evaluator.ts';
import { analyzeLine } from './analyzer.ts';

export * from './types.ts';
export * from './evaluator.ts';
export * from './parser.ts';
export * from './analyzer.ts';
export * from './validator.ts';

export interface TraceOptions {
  xMin?: number;
  xMax?: number;
  samples?: number;
}

export function traceEquations(sourceText: string, options: TraceOptions = {}): EquationTrace {
  const lines = sourceText.split(/\r?\n/);
  const steps: EquationStep[] = [];
  const diagnostics: EquationDiagnostic[] = [];

  const xMin = options.xMin ?? -10;
  const xMax = options.xMax ?? 10;
  const samples = options.samples ?? 201;

  const fnContext: FunctionContext = new Map();
  const knownFunctions = new Set<string>();
  const priorCurves: CurveSnapshot[] = [];

  let stepIndex = 0;

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const rawLine = lines[lineNum - 1];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    try {
      const parsed = parseEquationLine(rawLine, lineNum);
      if (!parsed) continue;

      const { functionName, parameterName, expressionText, ast } = parsed;

      // Sample points for this function using current context
      const points = sampleCurve(ast, fnContext, xMin, xMax, samples);

      // Save into context for subsequent functions
      const currentFn = (x: number) => evaluateAst(ast, x, fnContext);
      fnContext.set(functionName, currentFn);

      // Analyze transformation relative to known functions
      const analysis = analyzeLine(ast, functionName, expressionText, knownFunctions);
      knownFunctions.add(functionName);

      const activeCurve: CurveSnapshot = {
        name: functionName,
        expression: expressionText,
        color: '#0066cc', // TAKUMI blue accent
        isCurrent: true,
        points,
      };

      // Reference curves from prior steps (styled quieter)
      const referenceCurves: CurveSnapshot[] = priorCurves.map((c) => ({
        ...c,
        isCurrent: false,
      }));

      steps.push({
        index: stepIndex++,
        sourceLine: lineNum,
        rawText: rawLine,
        functionName,
        parameterName,
        expressionText,
        dependencies: analysis.dependencies,
        targetFunction: analysis.targetFunction,
        transformations: analysis.transformations,
        explanation: analysis.explanation,
        activeCurve,
        referenceCurves,
      });

      // Keep this curve in priorCurves for next steps
      priorCurves.push({
        name: functionName,
        expression: expressionText,
        color: 'rgba(98, 102, 109, 0.45)', // TAKUMI muted secondary
        isCurrent: false,
        points,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push({
        severity: 'error',
        code: 'PARSE_ERROR',
        message: msg,
        line: lineNum,
      });
    }
  }

  return {
    schemaVersion: EQUATION_TRACE_VERSION,
    traceId: `eq-trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: {
      text: sourceText,
      lines,
    },
    steps,
    diagnostics,
  };
}
