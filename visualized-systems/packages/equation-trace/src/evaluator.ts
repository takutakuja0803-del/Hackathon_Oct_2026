import type { PlottedPoint } from './types.ts';

export type MathNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'unary'; op: '-' | '+'; expr: MathNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: MathNode; right: MathNode }
  | { type: 'call'; name: string; arg: MathNode };

export type FunctionContext = Map<string, (x: number) => number>;

export function evaluateAst(
  node: MathNode,
  x: number,
  context: FunctionContext = new Map()
): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'variable':
      return x;

    case 'unary': {
      const v = evaluateAst(node.expr, x, context);
      return node.op === '-' ? -v : v;
    }

    case 'binary': {
      const l = evaluateAst(node.left, x, context);
      const r = evaluateAst(node.right, x, context);

      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? NaN : l / r;
        case '^': {
          if (l < 0 && !Number.isInteger(r)) return NaN;
          return Math.pow(l, r);
        }
      }
      return NaN;
    }

    case 'call': {
      const argVal = evaluateAst(node.arg, x, context);
      if (Number.isNaN(argVal) || !Number.isFinite(argVal)) return NaN;

      const fnLower = node.name.toLowerCase();
      // Built-in common math functions
      if (fnLower === 'sin') return Math.sin(argVal);
      if (fnLower === 'cos') return Math.cos(argVal);
      if (fnLower === 'abs') return Math.abs(argVal);
      if (fnLower === 'sqrt') return argVal < 0 ? NaN : Math.sqrt(argVal);
      if (fnLower === 'ln' || fnLower === 'log') return argVal <= 0 ? NaN : Math.log(argVal);
      if (fnLower === 'exp') return Math.exp(argVal);
      if (fnLower === 'tan') {
        const val = Math.tan(argVal);
        return Math.abs(val) > 1000 ? NaN : val;
      }

      // User function in context (e.g., f, g)
      const userFn = context.get(node.name);
      if (userFn) {
        return userFn(argVal);
      }

      return NaN;
    }
  }
}

export function sampleCurve(
  ast: MathNode,
  context: FunctionContext = new Map(),
  xMin = -10,
  xMax = 10,
  samples = 300
): PlottedPoint[] {
  const points: PlottedPoint[] = [];
  const dx = (xMax - xMin) / (samples - 1);

  for (let i = 0; i < samples; i++) {
    const x = xMin + i * dx;
    const y = evaluateAst(ast, x, context);

    if (Number.isFinite(y) && !Number.isNaN(y)) {
      points.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
    }
  }

  return points;
}
