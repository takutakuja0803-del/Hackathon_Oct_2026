import {
  EQUATION_TRACE_VERSION,
  type EquationTrace,
  type TransformationKind,
} from './types.ts';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_TRANSFORMATION_KINDS = new Set<TransformationKind>([
  'base-function',
  'vertical-shift',
  'horizontal-shift',
  'vertical-scale',
  'horizontal-scale',
  'reflection-x',
  'reflection-y',
  'composition',
  'unknown',
]);

export function validateEquationTrace(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, code: string, message: string) =>
    issues.push({ path, code, message, severity: 'error' });
  const warn = (path: string, code: string, message: string) =>
    issues.push({ path, code, message, severity: 'warning' });

  if (!isRecord(input)) {
    return [{ path: '$', code: 'trace.type', message: 'Trace must be an object', severity: 'error' }];
  }

  if (input.schemaVersion !== EQUATION_TRACE_VERSION) {
    err('$.schemaVersion', 'trace.version', `Expected schemaVersion "${EQUATION_TRACE_VERSION}"`);
  }

  if (typeof input.traceId !== 'string' || !input.traceId.trim()) {
    err('$.traceId', 'trace.id', 'traceId must be a non-empty string');
  }

  if (!isRecord(input.source)) {
    err('$.source', 'trace.source', 'source must be an object with text and lines');
  } else {
    if (typeof input.source.text !== 'string') {
      err('$.source.text', 'trace.source.text', 'source.text must be a string');
    }
    if (!Array.isArray(input.source.lines)) {
      err('$.source.lines', 'trace.source.lines', 'source.lines must be an array');
    }
  }

  if (!Array.isArray(input.diagnostics)) {
    err('$.diagnostics', 'trace.diagnostics', 'diagnostics must be an array');
  } else {
    input.diagnostics.forEach((d, idx) => {
      const p = `$.diagnostics[${idx}]`;
      if (!isRecord(d)) {
        err(p, 'diagnostic.type', 'diagnostic must be an object');
        return;
      }
      if (d.severity !== 'error' && d.severity !== 'warning') {
        err(`${p}.severity`, 'diagnostic.severity', 'severity must be "error" or "warning"');
      }
      if (typeof d.code !== 'string' || !d.code) {
        err(`${p}.code`, 'diagnostic.code', 'code must be a non-empty string');
      }
      if (typeof d.message !== 'string' || !d.message) {
        err(`${p}.message`, 'diagnostic.message', 'message must be a non-empty string');
      }
      if (d.line !== undefined && (typeof d.line !== 'number' || d.line < 1)) {
        err(`${p}.line`, 'diagnostic.line', 'line must be a positive 1-based number');
      }
    });
  }

  if (!Array.isArray(input.steps)) {
    err('$.steps', 'trace.steps', 'steps must be an array');
    return issues;
  }

  input.steps.forEach((step, idx) => {
    const p = `$.steps[${idx}]`;
    if (!isRecord(step)) {
      err(p, 'step.type', 'step must be an object');
      return;
    }

    if (typeof step.index !== 'number' || step.index !== idx) {
      err(`${p}.index`, 'step.index', `step.index must match sequence index ${idx}`);
    }

    if (typeof step.sourceLine !== 'number' || step.sourceLine < 1) {
      err(`${p}.sourceLine`, 'step.sourceLine', 'sourceLine must be a 1-based positive integer');
    }

    if (typeof step.rawText !== 'string') {
      err(`${p}.rawText`, 'step.rawText', 'rawText must be a string');
    }

    if (typeof step.functionName !== 'string' || !step.functionName.trim()) {
      err(`${p}.functionName`, 'step.functionName', 'functionName must be a non-empty string');
    }

    if (typeof step.parameterName !== 'string' || !step.parameterName.trim()) {
      err(`${p}.parameterName`, 'step.parameterName', 'parameterName must be a non-empty string');
    }

    if (typeof step.expressionText !== 'string' || !step.expressionText.trim()) {
      err(`${p}.expressionText`, 'step.expressionText', 'expressionText must be a non-empty string');
    }

    if (!Array.isArray(step.dependencies)) {
      err(`${p}.dependencies`, 'step.dependencies', 'dependencies must be an array of string function names');
    }

    if (typeof step.explanation !== 'string' || !step.explanation.trim()) {
      err(`${p}.explanation`, 'step.explanation', 'explanation must be a non-empty string');
    }

    if (!Array.isArray(step.transformations)) {
      err(`${p}.transformations`, 'step.transformations', 'transformations must be an array');
    } else {
      step.transformations.forEach((t, tIdx) => {
        const tp = `${p}.transformations[${tIdx}]`;
        if (!isRecord(t)) {
          err(tp, 'transformation.type', 'transformation must be an object');
          return;
        }
        if (!VALID_TRANSFORMATION_KINDS.has(t.kind as TransformationKind)) {
          err(`${tp}.kind`, 'transformation.kind', `Invalid transformation kind "${String(t.kind)}"`);
        }
        if (typeof t.description !== 'string' || !t.description.trim()) {
          err(`${tp}.description`, 'transformation.description', 'description must be a non-empty string');
        }
        if (t.parameter !== undefined && (typeof t.parameter !== 'number' || !Number.isFinite(t.parameter))) {
          err(`${tp}.parameter`, 'transformation.parameter', 'parameter must be a finite number if provided');
        }
      });
    }

    // Active curve validation
    if (!isRecord(step.activeCurve)) {
      err(`${p}.activeCurve`, 'curve.active', 'activeCurve must be an object');
    } else {
      const ac = step.activeCurve;
      if (typeof ac.name !== 'string' || !ac.name.trim()) {
        err(`${p}.activeCurve.name`, 'curve.name', 'activeCurve.name must be a non-empty string');
      }
      if (typeof ac.expression !== 'string') {
        err(`${p}.activeCurve.expression`, 'curve.expression', 'activeCurve.expression must be a string');
      }
      if (ac.isCurrent !== true) {
        err(`${p}.activeCurve.isCurrent`, 'curve.isCurrent', 'activeCurve.isCurrent must be true');
      }
      if (ac.points !== undefined) {
        if (!Array.isArray(ac.points)) {
          err(`${p}.activeCurve.points`, 'curve.points', 'points must be an array');
        } else {
          for (let ptIdx = 0; ptIdx < ac.points.length; ptIdx++) {
            const pt = ac.points[ptIdx];
            if (!isRecord(pt) || typeof pt.x !== 'number' || typeof pt.y !== 'number' || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
              err(`${p}.activeCurve.points[${ptIdx}]`, 'curve.point', 'each point must have finite numeric x and y values');
              break;
            }
          }
        }
      }
    }

    // Reference curves validation
    if (!Array.isArray(step.referenceCurves)) {
      err(`${p}.referenceCurves`, 'curve.references', 'referenceCurves must be an array');
    } else {
      step.referenceCurves.forEach((rc, rcIdx) => {
        const rcp = `${p}.referenceCurves[${rcIdx}]`;
        if (!isRecord(rc)) {
          err(rcp, 'curve.type', 'reference curve must be an object');
          return;
        }
        if (rc.isCurrent !== false) {
          warn(`${rcp}.isCurrent`, 'curve.isCurrent', 'reference curve isCurrent should be false');
        }
      });
    }
  });

  return issues;
}

export function assertValidEquationTrace(input: unknown): asserts input is EquationTrace {
  const errors = validateEquationTrace(input).filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Invalid EquationTrace: ${errors.map((e) => `${e.path} ${e.code}: ${e.message}`).join('; ')}`
    );
  }
}
