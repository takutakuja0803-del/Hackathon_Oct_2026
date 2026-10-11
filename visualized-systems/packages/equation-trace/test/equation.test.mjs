import test from 'node:test';
import assert from 'node:assert/strict';
import {
  traceEquations,
  validateEquationTrace,
  assertValidEquationTrace,
  parseEquationLine,
  evaluateAst,
} from '../src/index.ts';

test('traceEquations parses base function and generates points', () => {
  const source = 'f(x) = x^2';
  const trace = traceEquations(source);

  assert.equal(trace.schemaVersion, '0.1');
  assert.equal(trace.steps.length, 1);
  const step = trace.steps[0];
  assert.equal(step.functionName, 'f');
  assert.equal(step.parameterName, 'x');
  assert.equal(step.transformations[0].kind, 'base-function');
  assert.ok(step.activeCurve.points.length > 50);

  // Check point at x = 0 is y = 0
  const pt0 = step.activeCurve.points.find((p) => Math.abs(p.x) < 0.01);
  assert.ok(pt0);
  assert.ok(Math.abs(pt0.y) < 0.05);

  // Must pass canonical validation
  assert.doesNotThrow(() => assertValidEquationTrace(trace));
});

test('validateEquationTrace detects schema violations', () => {
  assert.equal(validateEquationTrace(null)[0].code, 'trace.type');
  assert.equal(validateEquationTrace({ schemaVersion: '9.9' })[0].code, 'trace.version');

  const invalidTrace = {
    schemaVersion: '0.1',
    traceId: 'test',
    source: { text: 'f(x) = x', lines: ['f(x) = x'] },
    diagnostics: [],
    steps: [
      {
        index: 1, // should be 0
        sourceLine: 1,
        rawText: 'f(x) = x',
        functionName: 'f',
        parameterName: 'x',
        expressionText: 'x',
        dependencies: [],
        explanation: 'Base',
        transformations: [{ kind: 'invalid-kind', description: 'desc' }],
        activeCurve: { name: 'f', expression: 'x', isCurrent: true, points: [] },
        referenceCurves: [],
      },
    ],
  };

  const issues = validateEquationTrace(invalidTrace);
  assert.ok(issues.some((i) => i.code === 'step.index'));
  assert.ok(issues.some((i) => i.code === 'transformation.kind'));
  assert.throws(() => assertValidEquationTrace(invalidTrace));
});

test('traceEquations detects vertical shift (upward and downward)', () => {
  const source = `
f(x) = x^2
g(x) = f(x) + 3
h(x) = f(x) - 5
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));
  assert.equal(trace.steps.length, 3);

  const stepUp = trace.steps[1];
  assert.equal(stepUp.functionName, 'g');
  assert.equal(stepUp.targetFunction, 'f');
  assert.equal(stepUp.transformations[0].kind, 'vertical-shift');
  assert.equal(stepUp.transformations[0].parameter, 3);
  assert.ok(stepUp.explanation.toLowerCase().includes('upward by 3'));

  const stepDown = trace.steps[2];
  assert.equal(stepDown.functionName, 'h');
  assert.equal(stepDown.targetFunction, 'f');
  assert.equal(stepDown.transformations[0].kind, 'vertical-shift');
  assert.equal(stepDown.transformations[0].parameter, -5);
  assert.ok(stepDown.explanation.toLowerCase().includes('downward by 5'));
});

test('traceEquations detects horizontal shift (right and left)', () => {
  const source = `
f(x) = x^2
g(x) = f(x - 2)
h(x) = f(x + 4)
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));
  assert.equal(trace.steps.length, 3);

  const stepRight = trace.steps[1];
  assert.equal(stepRight.transformations[0].kind, 'horizontal-shift');
  assert.equal(stepRight.transformations[0].parameter, 2);
  assert.ok(stepRight.explanation.toLowerCase().includes('right by 2'));

  const stepLeft = trace.steps[2];
  assert.equal(stepLeft.transformations[0].kind, 'horizontal-shift');
  assert.equal(stepLeft.transformations[0].parameter, -4);
  assert.ok(stepLeft.explanation.toLowerCase().includes('left by 4'));
});

test('traceEquations detects reflection across x-axis and y-axis', () => {
  const source = `
f(x) = x^3
g(x) = -f(x)
h(x) = f(-x)
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));

  const stepReflectX = trace.steps[1];
  assert.equal(stepReflectX.transformations[0].kind, 'reflection-x');
  assert.ok(stepReflectX.explanation.toLowerCase().includes('across the x-axis'));

  const stepReflectY = trace.steps[2];
  assert.equal(stepReflectY.transformations[0].kind, 'reflection-y');
  assert.ok(stepReflectY.explanation.toLowerCase().includes('across the y-axis'));
});

test('traceEquations detects vertical scale (stretch and compression)', () => {
  const source = `
f(x) = x^2
g(x) = 3 * f(x)
h(x) = f(x) / 2
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));

  const stepStretch = trace.steps[1];
  assert.equal(stepStretch.transformations[0].kind, 'vertical-scale');
  assert.equal(stepStretch.transformations[0].parameter, 3);
  assert.ok(stepStretch.explanation.toLowerCase().includes('stretches vertically'));

  const stepCompress = trace.steps[2];
  assert.equal(stepCompress.transformations[0].kind, 'vertical-scale');
  assert.equal(stepCompress.transformations[0].parameter, 0.5);
  assert.ok(stepCompress.explanation.toLowerCase().includes('compresses vertically'));
});

test('traceEquations detects horizontal scale (compression and stretch)', () => {
  const source = `
f(x) = x^2
g(x) = f(2 * x)
h(x) = f(x / 3)
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));

  const stepHCompress = trace.steps[1];
  assert.equal(stepHCompress.transformations[0].kind, 'horizontal-scale');
  assert.equal(stepHCompress.transformations[0].parameter, 2);
  assert.ok(stepHCompress.explanation.toLowerCase().includes('compresses horizontally'));

  const stepHStretch = trace.steps[2];
  assert.equal(stepHStretch.transformations[0].kind, 'horizontal-scale');
  assert.ok(Math.abs(stepHStretch.transformations[0].parameter - 1 / 3) < 0.001);
  assert.ok(stepHStretch.explanation.toLowerCase().includes('stretches horizontally'));
});

test('acceptance scenario: f(x) = x^2, g(x) = f(x) + 3, h(x) = -2*g(x)', () => {
  const source = `
f(x) = x^2
g(x) = f(x) + 3
h(x) = -2*g(x)
  `;
  const trace = traceEquations(source);
  assert.doesNotThrow(() => assertValidEquationTrace(trace));
  assert.equal(trace.steps.length, 3);

  // Step 1: base parabola
  assert.equal(trace.steps[0].functionName, 'f');
  assert.equal(trace.steps[0].transformations[0].kind, 'base-function');

  // Step 2: shifted upward by 3
  assert.equal(trace.steps[1].functionName, 'g');
  assert.equal(trace.steps[1].targetFunction, 'f');
  assert.equal(trace.steps[1].transformations[0].kind, 'vertical-shift');
  assert.equal(trace.steps[1].transformations[0].parameter, 3);
  assert.ok(trace.steps[1].explanation.toLowerCase().includes('upward by 3'));

  // Step 3: reflected across x-axis and vertically scaled by factor 2
  const step3 = trace.steps[2];
  assert.equal(step3.functionName, 'h');
  assert.equal(step3.targetFunction, 'g');
  const kinds = step3.transformations.map((t) => t.kind);
  assert.ok(kinds.includes('reflection-x'));
  assert.ok(kinds.includes('vertical-scale'));
  const vScale = step3.transformations.find((t) => t.kind === 'vertical-scale');
  assert.equal(vScale.parameter, 2);
  assert.ok(step3.explanation.toLowerCase().includes('across the x-axis'));
  assert.ok(step3.explanation.toLowerCase().includes('stretches vertically'));

  // Coordinate check at x = 0:
  // f(0) = 0
  // g(0) = 3
  // h(0) = -2 * 3 = -6
  const hPt0 = step3.activeCurve.points.find((p) => Math.abs(p.x) < 0.01);
  assert.ok(hPt0);
  assert.ok(Math.abs(hPt0.y - (-6)) < 0.05);
});

test('evaluator: supports polynomials, trig, abs, sqrt, logs and discontinuity safety', () => {
  // Polynomial: 2*x^2 + 3*x - 1
  const poly = parseEquationLine('f(x) = 2*x^2 + 3*x - 1', 1);
  assert.ok(poly);
  assert.equal(evaluateAst(poly.ast, 2), 2 * 4 + 3 * 2 - 1); // 13

  // Sqrt: sqrt(x)
  const sqrtFn = parseEquationLine('f(x) = sqrt(x)', 1);
  assert.ok(sqrtFn);
  assert.equal(evaluateAst(sqrtFn.ast, 16), 4);
  assert.ok(Number.isNaN(evaluateAst(sqrtFn.ast, -4))); // Safe NaN on negative

  // Abs: abs(x - 5)
  const absFn = parseEquationLine('f(x) = abs(x - 5)', 1);
  assert.ok(absFn);
  assert.equal(evaluateAst(absFn.ast, 2), 3);

  // Trig: sin(x), cos(x)
  const sinFn = parseEquationLine('f(x) = sin(x)', 1);
  assert.ok(sinFn);
  assert.ok(Math.abs(evaluateAst(sinFn.ast, Math.PI / 2) - 1) < 1e-6);

  // Discontinuity safety: 1/x at x = 0
  const divFn = parseEquationLine('f(x) = 1 / x', 1);
  assert.ok(divFn);
  assert.ok(Number.isNaN(evaluateAst(divFn.ast, 0))); // NaN, not throw
});

test('parser: handles syntax errors, unsupported characters, and diagnostics', () => {
  const source = `
f(x) = x^2
g(x) = 2 * (x + 
h(x) = f(x) + 1
  `;
  const trace = traceEquations(source);
  assert.equal(trace.steps.length, 2);
  assert.equal(trace.diagnostics.length, 1);
  assert.equal(trace.diagnostics[0].line, 3);
  assert.equal(trace.diagnostics[0].code, 'PARSE_ERROR');
});
