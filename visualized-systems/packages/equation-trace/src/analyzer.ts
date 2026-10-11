import type { MathNode } from './evaluator.ts';
import type { MathTransformation } from './types.ts';

export interface AnalysisResult {
  dependencies: string[];
  targetFunction?: string;
  transformations: MathTransformation[];
  explanation: string;
}

export function extractDependencies(node: MathNode, knownFunctions: Set<string>): string[] {
  const deps = new Set<string>();

  function walk(n: MathNode) {
    if (n.type === 'call') {
      if (knownFunctions.has(n.name)) {
        deps.add(n.name);
      }
      walk(n.arg);
    } else if (n.type === 'unary') {
      walk(n.expr);
    } else if (n.type === 'binary') {
      walk(n.left);
      walk(n.right);
    }
  }

  walk(node);
  return Array.from(deps);
}

interface AffineTransform {
  targetFn: string;
  verticalScale: number;
  verticalShift: number;
  horizontalScale: number;
  horizontalShift: number;
}

function extractConstantValue(node: MathNode): number | null {
  if (node.type === 'number') return node.value;
  if (node.type === 'unary') {
    const val = extractConstantValue(node.expr);
    if (val !== null) return node.op === '-' ? -val : val;
  }
  return null;
}

/**
 * Matches an AST to a standard affine transformation of a known target function:
 * a * targetFn(b * (x - h)) + k
 * Supports:
 * - Vertical shifts: + k, - k
 * - Vertical scalings: * a, / a, and unary -
 * - Horizontal shifts: (x - h), (x + h)
 * - Horizontal scalings: (b * x), (x / b), (b * (x - h))
 * - Reflections: -targetFn(...) across x-axis, targetFn(-x) across y-axis
 */
function matchAffineTransformation(
  node: MathNode,
  knownFunctions: Set<string>
): AffineTransform | null {
  let verticalShift = 0;
  let mainTerm: MathNode = node;

  // 1. Extract vertical shift (+ k, - k)
  if (node.type === 'binary' && (node.op === '+' || node.op === '-')) {
    const rightVal = extractConstantValue(node.right);
    const leftVal = extractConstantValue(node.left);

    if (rightVal !== null) {
      verticalShift = node.op === '+' ? rightVal : -rightVal;
      mainTerm = node.left;
    } else if (leftVal !== null && node.op === '+') {
      verticalShift = leftVal;
      mainTerm = node.right;
    }
  }

  // 2. Extract vertical scale (* a, / a, -)
  let verticalScale = 1;
  let fnCallNode: MathNode = mainTerm;

  // Unary minus: -term
  if (fnCallNode.type === 'unary' && fnCallNode.op === '-') {
    verticalScale *= -1;
    fnCallNode = fnCallNode.expr;
  }

  // Binary multiplication or division
  if (fnCallNode.type === 'binary' && (fnCallNode.op === '*' || fnCallNode.op === '/')) {
    if (fnCallNode.op === '*') {
      const leftVal = extractConstantValue(fnCallNode.left);
      const rightVal = extractConstantValue(fnCallNode.right);

      if (leftVal !== null) {
        verticalScale *= leftVal;
        fnCallNode = fnCallNode.right;
      } else if (rightVal !== null) {
        verticalScale *= rightVal;
        fnCallNode = fnCallNode.left;
      }
    } else if (fnCallNode.op === '/') {
      const rightVal = extractConstantValue(fnCallNode.right);
      if (rightVal !== null && rightVal !== 0) {
        verticalScale /= rightVal;
        fnCallNode = fnCallNode.left;
      }
    }
  }

  // Check unary minus again if expression was -(a * f(x)) or -f(x)
  if (fnCallNode.type === 'unary' && fnCallNode.op === '-') {
    verticalScale *= -1;
    fnCallNode = fnCallNode.expr;
  }

  if (fnCallNode.type !== 'call' || !knownFunctions.has(fnCallNode.name)) {
    return null;
  }

  const targetFn = fnCallNode.name;
  const innerArg = fnCallNode.arg;

  // 3. Extract horizontal transformations inside innerArg
  let horizontalScale = 1;
  let horizontalShift = 0;

  if (innerArg.type === 'variable') {
    // f(x) -> no shift, no scale
  } else if (innerArg.type === 'unary' && innerArg.op === '-' && innerArg.expr.type === 'variable') {
    // f(-x) -> reflection across y-axis
    horizontalScale = -1;
  } else if (innerArg.type === 'binary' && (innerArg.op === '+' || innerArg.op === '-')) {
    // f(x - h) or f(x + h)
    const rightConst = extractConstantValue(innerArg.right);
    const leftConst = extractConstantValue(innerArg.left);

    if (innerArg.left.type === 'variable' && rightConst !== null) {
      horizontalShift = innerArg.op === '-' ? rightConst : -rightConst;
    } else if (leftConst !== null && innerArg.op === '+' && innerArg.right.type === 'variable') {
      horizontalShift = -leftConst;
    }
  } else if (innerArg.type === 'binary' && (innerArg.op === '*' || innerArg.op === '/')) {
    if (innerArg.op === '*') {
      const leftConst = extractConstantValue(innerArg.left);
      const rightConst = extractConstantValue(innerArg.right);

      if (leftConst !== null) {
        horizontalScale = leftConst;
        // Check for factored form: b * (x - h)
        if (innerArg.right.type === 'binary' && (innerArg.right.op === '+' || innerArg.right.op === '-')) {
          const shiftVal = extractConstantValue(innerArg.right.right);
          if (innerArg.right.left.type === 'variable' && shiftVal !== null) {
            horizontalShift = innerArg.right.op === '-' ? shiftVal : -shiftVal;
          }
        }
      } else if (rightConst !== null) {
        horizontalScale = rightConst;
        if (innerArg.left.type === 'binary' && (innerArg.left.op === '+' || innerArg.left.op === '-')) {
          const shiftVal = extractConstantValue(innerArg.left.right);
          if (innerArg.left.left.type === 'variable' && shiftVal !== null) {
            horizontalShift = innerArg.left.op === '-' ? shiftVal : -shiftVal;
          }
        }
      }
    } else if (innerArg.op === '/') {
      // f(x / b) -> horizontalScale = 1 / b
      const rightConst = extractConstantValue(innerArg.right);
      if (rightConst !== null && rightConst !== 0) {
        horizontalScale = 1 / rightConst;
        if (innerArg.left.type === 'binary' && (innerArg.left.op === '+' || innerArg.left.op === '-')) {
          const shiftVal = extractConstantValue(innerArg.left.right);
          if (innerArg.left.left.type === 'variable' && shiftVal !== null) {
            horizontalShift = innerArg.left.op === '-' ? shiftVal : -shiftVal;
          }
        }
      }
    }
  }

  return {
    targetFn,
    verticalScale,
    verticalShift,
    horizontalScale,
    horizontalShift,
  };
}

export function analyzeLine(
  node: MathNode,
  fnName: string,
  expressionText: string,
  knownFunctions: Set<string>
): AnalysisResult {
  const dependencies = extractDependencies(node, knownFunctions);

  if (dependencies.length === 0) {
    const isTrig =
      expressionText.includes('sin') ||
      expressionText.includes('cos') ||
      expressionText.includes('tan');
    const isPoly = expressionText.includes('^');
    let desc = `Defines base function ${fnName}(x) = ${expressionText}.`;
    if (isTrig) desc = `Defines trigonometric base function ${fnName}(x) = ${expressionText}.`;
    else if (isPoly) desc = `Defines polynomial base function ${fnName}(x) = ${expressionText}.`;

    return {
      dependencies: [],
      transformations: [
        {
          kind: 'base-function',
          description: desc,
        },
      ],
      explanation: desc,
    };
  }

  const targetFn = dependencies[0];
  const affine = matchAffineTransformation(node, knownFunctions);

  if (affine && affine.targetFn === targetFn) {
    const transformations: MathTransformation[] = [];
    const narrativeParts: string[] = [];

    // Horizontal shift
    if (affine.horizontalShift !== 0) {
      const dir = affine.horizontalShift > 0 ? 'right' : 'left';
      const absVal = Math.abs(affine.horizontalShift);
      transformations.push({
        kind: 'horizontal-shift',
        parameter: affine.horizontalShift,
        targetFunction: targetFn,
        description: `Shifts ${targetFn}(x) horizontally to the ${dir} by ${absVal} unit${absVal === 1 ? '' : 's'}.`,
      });
      narrativeParts.push(`shifts ${dir} by ${absVal}`);
    }

    // Horizontal reflection & scaling
    if (affine.horizontalScale < 0) {
      transformations.push({
        kind: 'reflection-y',
        targetFunction: targetFn,
        description: `Reflects ${targetFn}(x) across the y-axis.`,
      });
      narrativeParts.push('reflects across the y-axis');
    }

    const absHScale = Math.abs(affine.horizontalScale);
    if (absHScale !== 1 && absHScale !== 0) {
      const factor = Number((1 / absHScale).toFixed(4));
      const isCompress = absHScale > 1;
      transformations.push({
        kind: 'horizontal-scale',
        parameter: absHScale,
        targetFunction: targetFn,
        description: `${isCompress ? 'Compresses' : 'Stretches'} ${targetFn}(x) horizontally by a factor of ${factor}.`,
      });
      narrativeParts.push(
        `${isCompress ? 'compresses' : 'stretches'} horizontally by a factor of ${factor}`
      );
    }

    // Vertical reflection & scaling
    if (affine.verticalScale < 0) {
      transformations.push({
        kind: 'reflection-x',
        targetFunction: targetFn,
        description: `Reflects ${targetFn}(x) across the x-axis.`,
      });
      narrativeParts.push('reflects across the x-axis');
    }

    const absVScale = Math.abs(affine.verticalScale);
    if (absVScale !== 1) {
      const isStretch = absVScale > 1;
      transformations.push({
        kind: 'vertical-scale',
        parameter: absVScale,
        targetFunction: targetFn,
        description: `${isStretch ? 'Stretches' : 'Compresses'} ${targetFn}(x) vertically by a factor of ${absVScale}.`,
      });
      narrativeParts.push(
        `${isStretch ? 'stretches' : 'compresses'} vertically by a factor of ${absVScale}`
      );
    }

    // Vertical shift
    if (affine.verticalShift !== 0) {
      const dir = affine.verticalShift > 0 ? 'upward' : 'downward';
      const absVal = Math.abs(affine.verticalShift);
      transformations.push({
        kind: 'vertical-shift',
        parameter: affine.verticalShift,
        targetFunction: targetFn,
        description: `Shifts ${targetFn}(x) vertically ${dir} by ${absVal} unit${absVal === 1 ? '' : 's'}.`,
      });
      narrativeParts.push(`shifts ${dir} by ${absVal}`);
    }

    if (transformations.length > 0) {
      const joined = narrativeParts.join(', and ');
      const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
      const explanation = `${fnName}(x) ${capitalized} relative to ${targetFn}(x).`;
      return {
        dependencies,
        targetFunction: targetFn,
        transformations,
        explanation,
      };
    }
  }

  // Fallback for general composition
  const desc = `${fnName}(x) defines a composition based on ${dependencies.join(', ')}.`;
  return {
    dependencies,
    targetFunction: targetFn,
    transformations: [
      {
        kind: 'composition',
        targetFunction: targetFn,
        description: desc,
      },
    ],
    explanation: desc,
  };
}
