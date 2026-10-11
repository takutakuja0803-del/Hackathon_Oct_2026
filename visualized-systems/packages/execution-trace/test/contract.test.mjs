import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertValidExecutionTrace, validateExecutionTrace } from '../src/index.ts';

const fixture = async name => JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

test('canonical fixtures satisfy v0.2', async () => {
  for (const name of ['scalar-pointer.json', 'unknown-and-unavailable.json', 'frames-arrays-references.json']) {
    const trace = await fixture(name);
    assert.deepEqual(validateExecutionTrace(trace).filter(i => i.severity === 'error'), []);
    assert.doesNotThrow(() => assertValidExecutionTrace(trace));
  }
});

test('stable identity may recur across snapshots', async () => {
  const trace = await fixture('scalar-pointer.json');
  assert.equal(validateExecutionTrace(trace).some(i => i.code === 'identity.duplicate'), false);
});

test('unknown and unavailable values are distinct and valid', async () => {
  const trace = await fixture('unknown-and-unavailable.json');
  const values = trace.steps[0].frames[0].variables.map(v => v.value);
  assert.equal(values[0].availability.status, 'unknown');
  assert.equal(values[1].availability.status, 'unavailable');
  assert.deepEqual(validateExecutionTrace(trace).filter(i => i.severity === 'error'), []);
});

test('rejects a null pointer that claims a nonzero address', async () => {
  const trace = await fixture('scalar-pointer.json');
  const p = trace.steps[1].frames[0].variables[1].value;
  p.resolution = { status: 'null', provenance: 'fixture-authored' };
  const issues = validateExecutionTrace(trace);
  assert.ok(issues.some(i => i.code === 'pointer.null-contradiction'));
});

test('rejects a null pointer without a known zero address', async () => {
  const trace = await fixture('scalar-pointer.json');
  const p = trace.steps[1].frames[0].variables[1].value;
  p.resolution = { status: 'null', provenance: 'fixture-authored' };
  p.addressValue = { status: 'unknown', reason: 'not observed' };
  assert.ok(validateExecutionTrace(trace).some(i => i.code === 'pointer.null-unproven'));
});

test('rejects references to storage absent from the snapshot', async () => {
  const trace = await fixture('scalar-pointer.json');
  trace.steps[1].frames[0].variables[1].value.resolution.targetStorageId = 'missing';
  const issues = validateExecutionTrace(trace);
  assert.ok(issues.some(i => i.code === 'reference.target-missing'));
});

test('rejects out-of-range source locations', async () => {
  const trace = await fixture('scalar-pointer.json');
  trace.steps[0].location.line.value = 999;
  const issues = validateExecutionTrace(trace);
  assert.ok(issues.some(i => i.code === 'location.range'));
});

test('rejects incorrect version and step numbering', async () => {
  const trace = await fixture('scalar-pointer.json');
  trace.schemaVersion = '0.3';
  trace.steps[0].index = 4;
  const issues = validateExecutionTrace(trace);
  assert.ok(issues.some(i => i.code === 'trace.version'));
  assert.ok(issues.some(i => i.code === 'step.index'));
});

test('canonical frames, arrays, references, and parameters satisfy contract', async () => {
  const trace = await fixture('frames-arrays-references.json');
  const frames = trace.steps[0].frames;
  assert.equal(frames[0].functionName.value, 'read');
  assert.equal(frames[1].functionName.value, 'main');
  assert.equal(frames[0].variables[1].value.kind, 'reference');
  assert.equal(frames[0].variables[2].value.elements.length, 2);
  assert.equal(frames[0].variables[1].role, 'parameter');
  assert.equal(frames[0].variables[0].value.display, '3');
  assert.deepEqual(validateExecutionTrace(trace).filter(i => i.severity === 'error'), []);
});

test('pointer numeric value and storage identity are separate fields', async () => {
  const trace = await fixture('scalar-pointer.json');
  const x = trace.steps[1].frames[0].variables[0];
  const p = trace.steps[1].frames[0].variables[1];
  assert.equal(p.value.addressValue.value, x.address.value);
  assert.equal(p.value.resolution.targetStorageId, x.storageId);
  assert.notEqual(x.storageId, x.address.value);
  assert.notEqual(x.id, x.address.value);
});

test('rejects a non-hexadecimal runtime address', async () => {
  const trace = await fixture('scalar-pointer.json');
  trace.steps[1].frames[0].variables[0].address.value = 'stack-slot-1';
  assert.ok(validateExecutionTrace(trace).some(i => i.code === 'variable.address'));
});

test('unknown source locations are valid, without inventing a line', async () => {
  const trace = await fixture('scalar-pointer.json');
  trace.steps[0].location = { status: 'unknown', reason: 'No source mapping at stop.' };
  trace.steps[0].frames[0].location = { status: 'unavailable', reason: 'No debug line entry.' };
  assert.deepEqual(validateExecutionTrace(trace).filter(i => i.severity === 'error'), []);
});

test('references cannot resolve to null', async () => {
  const trace = await fixture('frames-arrays-references.json');
  trace.steps[0].frames[0].variables[1].value.target = { status: 'null', provenance: 'fixture-authored' };
  assert.ok(validateExecutionTrace(trace).some(i => i.code === 'reference.null'));
});

test('expired pointer requires evidence of ended storage', async () => {
  const trace = await fixture('scalar-pointer.json');
  const p = trace.steps[2].frames[0].variables[1].value;
  p.resolution = { status: 'expired-by-observed-lifetime', targetStorageId: 'storage-main-x', provenance: 'fixture-authored' };
  assert.ok(validateExecutionTrace(trace).some(i => i.code === 'lifetime.unproven'));
  trace.steps[2].storage[0].lifetime = 'ended';
  assert.equal(validateExecutionTrace(trace).some(i => i.code === 'lifetime.unproven'), false);
});
