import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateSource } from '../src/parser.ts';
import { traceCppCode } from '../src/index.ts';
import { validateExecutionTrace } from '../../execution-trace/src/index.ts';

test('parser: accepts supported pointer mutation program', () => {
  const code = `int main() {
    int x = 5;
    int* p = &x;
    *p = 10;
    return 0;
}`;
  const res = parseAndValidateSource(code);
  assert.equal(res.success, true);
  assert.ok(res.mainFunction);
  assert.equal(res.mainFunction.statements.length, 4);
  assert.equal(res.mainFunction.statements[0].varName, 'x');
  assert.equal(res.mainFunction.statements[1].varName, 'p');
  assert.equal(res.mainFunction.statements[2].varName, 'p');
  assert.equal(res.mainFunction.statements[2].kind, 'deref_assignment');
});

test('parser: rejects unsupported C++ constructs with clear diagnostic', () => {
  const unsupportedVector = `int main() {
    std::vector<int> v;
    return 0;
}`;
  const res1 = parseAndValidateSource(unsupportedVector);
  assert.equal(res1.success, false);
  assert.ok(res1.diagnostics.length > 0);
  assert.match(res1.diagnostics[0].message, /unsupported construct/i);

  const unsupportedClass = `class MyClass {};
int main() {
    return 0;
}`;
  const res2 = parseAndValidateSource(unsupportedClass);
  assert.equal(res2.success, false);
  assert.match(res2.diagnostics[0].message, /unsupported construct/i);
});

test('parser: rejects missing main function', () => {
  const code = `void helper() {}`;
  const res = parseAndValidateSource(code);
  assert.equal(res.success, false);
  assert.equal(res.diagnostics[0].code, 'syntax.missing-main');
  assert.match(res.diagnostics[0].message, /main/i);
});

test('end-to-end: compiles and traces first milestone pointer program', async () => {
  const source = `int main() {
    int x = 5;
    int* p = &x;
    *p = 10;
    return 0;
}`;

  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Trace failed: ${result.error}`);
  assert.ok(result.trace, 'Trace must be defined');

  const trace = result.trace;

  // 1. Canonical validation
  const validationIssues = validateExecutionTrace(trace);
  const errors = validationIssues.filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);

  // 2. Step count: 3 state snapshots (after line 2, line 3, line 4)
  assert.equal(trace.steps.length, 3);

  // Step 0: int x = 5;
  const step0 = trace.steps[0];
  assert.equal(step0.location.status, 'known');
  if (step0.location.status === 'known') {
    assert.equal(step0.location.line.value, 2);
  }
  assert.equal(step0.frames[0].variables.length, 1);
  const x0 = step0.frames[0].variables[0];
  assert.equal(x0.value.kind, 'scalar');
  if (x0.value.kind === 'scalar') {
    assert.equal(x0.value.display, '5');
  }
  const xStorageId = x0.storageId;
  assert.ok(xStorageId, 'x must have storageId');

  // Step 1: int* p = &x;
  const step1 = trace.steps[1];
  assert.equal(step1.location.status, 'known');
  if (step1.location.status === 'known') {
    assert.equal(step1.location.line.value, 3);
  }
  assert.equal(step1.frames[0].variables.length, 2);
  const p1 = step1.frames[0].variables.find((v) => {
    return v.name.status === 'known' ? v.name.value === 'p' : false;
  }) || step1.frames[0].variables[1];
  assert.equal(p1.value.kind, 'pointer');
  if (p1.value.kind === 'pointer') {
    assert.equal(p1.value.resolution.status, 'resolved');
    if (p1.value.resolution.status === 'resolved') {
      // Must point to x's storage object!
      assert.equal(p1.value.resolution.targetStorageId, xStorageId);
    }
  }

  // Step 2: *p = 10;
  const step2 = trace.steps[2];
  assert.equal(step2.location.status, 'known');
  if (step2.location.status === 'known') {
    assert.equal(step2.location.line.value, 4);
  }
  const x2 = step2.frames[0].variables.find((v) => {
    return v.name.status === 'known' ? v.name.value === 'x' : false;
  }) || step2.frames[0].variables[0];
  assert.equal(x2.value.kind, 'scalar');
  if (x2.value.kind === 'scalar') {
    // Value mutated to 10!
    assert.equal(x2.value.display, '10');
  }
  // Storage ID must remain IDENTICAL to preserve visual identity!
  assert.equal(x2.storageId, xStorageId);
  const xStorage2 = step2.storage.find((s) => s.id === xStorageId);
  assert.ok(xStorage2);
  if (xStorage2 && xStorage2.value && xStorage2.value.kind === 'scalar') {
    assert.equal(xStorage2.value.display, '10');
  }
});

test('end-to-end: feature 1 - arithmetic expressions (+, -, *, /, %, parens)', async () => {
  const source = `int main() {
    int x = 5;
    int y = 3;
    int z = x + y;
    z = z * 2;
    return 0;
}`;
  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Trace failed: ${result.error}`);
  assert.ok(result.trace);

  const errors = validateExecutionTrace(result.trace).filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0);

  const steps = result.trace.steps;
  assert.equal(steps.length, 4);

  // Line 2: x = 5
  assert.equal(steps[0].frames[0].variables[0].value.display, '5');
  // Line 3: y = 3
  assert.equal(steps[1].frames[0].variables[1].value.display, '3');
  // Line 4: z = 8 (5 + 3)
  assert.equal(steps[2].frames[0].variables[2].value.display, '8');
  // Line 5: z = 16 (8 * 2)
  assert.equal(steps[3].frames[0].variables[2].value.display, '16');
});

test('end-to-end: feature 2 - references (aliasing x, no separate storage, mutation)', async () => {
  const source = `int main() {
    int x = 5;
    int& r = x;
    r = 20;
    return 0;
}`;
  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Trace failed: ${result.error}`);
  assert.ok(result.trace);

  const errors = validateExecutionTrace(result.trace).filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0);

  const steps = result.trace.steps;
  assert.equal(steps.length, 3);

  // Step 1: int& r = x;
  const step1 = steps[1];
  const rVar1 = step1.frames[0].variables.find((v) => v.name.value === 'r');
  assert.ok(rVar1);
  assert.equal(rVar1.value.kind, 'reference');
  if (rVar1.value.kind === 'reference') {
    assert.equal(rVar1.value.target.status, 'resolved');
    assert.equal(rVar1.storageId, 'storage-main-x');
  }
  // Storage count must be exactly 1: only storage-main-x!
  assert.equal(step1.storage.length, 1);
  assert.equal(step1.storage[0].id, 'storage-main-x');

  // Step 2: r = 20;
  const step2 = steps[2];
  const xVar2 = step2.frames[0].variables.find((v) => v.name.value === 'x');
  assert.ok(xVar2);
  assert.equal(xVar2.value.display, '20');
  // Storage object value updated to 20!
  assert.equal(step2.storage.length, 1);
  assert.equal(step2.storage[0].value.display, '20');
});

test('end-to-end: feature 3 - fixed-size arrays (contiguous cells, mutation)', async () => {
  const source = `int main() {
    int arr[3] = {1, 2, 3};
    arr[1] = 9;
    return 0;
}`;
  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Trace failed: ${result.error}`);
  assert.ok(result.trace);

  const errors = validateExecutionTrace(result.trace).filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0);

  const steps = result.trace.steps;
  assert.equal(steps.length, 2);

  // Step 0: array initialized
  const step0 = steps[0];
  const arr0 = step0.frames[0].variables[0];
  assert.equal(arr0.value.kind, 'array');
  if (arr0.value.kind === 'array') {
    assert.equal(arr0.value.elements.length, 3);
    assert.equal(arr0.value.elements[0].value.display, '1');
    assert.equal(arr0.value.elements[1].value.display, '2');
    assert.equal(arr0.value.elements[2].value.display, '3');
  }

  // Step 1: arr[1] = 9
  const step1 = steps[1];
  const arr1 = step1.frames[0].variables[0];
  assert.equal(arr1.value.kind, 'array');
  if (arr1.value.kind === 'array') {
    assert.equal(arr1.value.elements[0].value.display, '1');
    assert.equal(arr1.value.elements[1].value.display, '9');
    assert.equal(arr1.value.elements[2].value.display, '3');
  }
});

test('end-to-end: feature 4 - user-defined function calls (stack push/pop)', async () => {
  const source = `int add(int a, int b) {
    int result = a + b;
    return result;
}
int main() {
    int x = 5;
    int y = 3;
    int z = add(x, y);
    return 0;
}`;
  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Trace failed: ${result.error}`);
  assert.ok(result.trace);

  const errors = validateExecutionTrace(result.trace).filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0);

  const steps = result.trace.steps;
  // Steps:
  // 1. int x = 5 (in main)
  // 2. int y = 3 (in main)
  // 3. int result = a + b (in add)
  // 4. int z = add(x, y) (in main after add returns)
  assert.equal(steps.length, 4);

  // Step 2 is inside add:
  const insideAddStep = steps[2];
  // Must have 2 frames: add (innermost) above main!
  assert.equal(insideAddStep.frames.length, 2);
  assert.equal(insideAddStep.frames[0].functionName.value, 'add');
  assert.equal(insideAddStep.frames[1].functionName.value, 'main');
  // Check parameter values and result inside add:
  const resultVar = insideAddStep.frames[0].variables.find((v) => v.name.value === 'result');
  assert.ok(resultVar);
  assert.equal(resultVar.value.display, '8');

  // Step 3 is back in main:
  const returnStep = steps[3];
  // add frame has popped, only main remains!
  assert.equal(returnStep.frames.length, 1);
  assert.equal(returnStep.frames[0].functionName.value, 'main');
  const zVar = returnStep.frames[0].variables.find((v) => v.name.value === 'z');
  assert.ok(zVar);
  assert.equal(zVar.value.display, '8');
});

test('compiler: reports error on invalid syntax', async () => {
  const badCode = `int main() {
    int x = ;
    return 0;
}`;
  const result = await traceCppCode(badCode);
  assert.equal(result.success, false);
  assert.ok(result.diagnostics.length > 0);
});

test('parser: handles whitespace and pointer symbol variations', async () => {
  const variantCode = `int main() {
    int x=5;
    int *p=&x;
    * p = 10;
    return 0;
}`;
  const result = await traceCppCode(variantCode);
  assert.equal(result.success, true, `Variant trace failed: ${result.error}`);
  assert.equal(result.trace?.steps.length, 3);
  assert.equal(result.trace?.steps[2].frames[0].variables[0].value.display, '10');
});

test('parser: rejects unknown types and unsupported keywords', () => {
  const badType = `int main() {
    double y = 3.14;
    return 0;
}`;
  const res = parseAndValidateSource(badType);
  assert.equal(res.success, false);
});

test('end-to-end: stretch goal - pointer swap function call', async () => {
  const source = `void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}
int main() {
    int x = 5;
    int y = 10;
    swap(&x, &y);
    return 0;
}`;
  const result = await traceCppCode(source);
  assert.equal(result.success, true, `Swap trace failed: ${result.error}`);
  assert.ok(result.trace);

  const errors = validateExecutionTrace(result.trace).filter((i) => i.severity === 'error');
  assert.equal(errors.length, 0);

  const steps = result.trace.steps;
  assert.equal(steps.length, 6);

  // Final step in main: x is 10, y is 5
  const finalStep = steps[5];
  assert.equal(finalStep.frames.length, 1);
  assert.equal(finalStep.frames[0].functionName.value, 'main');
  assert.equal(finalStep.frames[0].variables[0].value.display, '10');
  assert.equal(finalStep.frames[0].variables[1].value.display, '5');
});
