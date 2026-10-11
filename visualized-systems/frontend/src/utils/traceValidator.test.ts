import { describe, it, expect } from 'vitest';
import { summarizeValidation } from './traceValidator';
import { fixtureA_basicMutation } from '../fixtures/fixtureA_basicMutation';
import { fixtureH_newDelete } from '../fixtures/fixtureH_newDelete';
import { ExecutionTrace } from '@visualized-gdb/execution-trace';

describe('Canonical v0.2 traceValidator unit tests', () => {
  it('validates fixture A without any errors', () => {
    const res = summarizeValidation(fixtureA_basicMutation);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('validates fixture H (heap lifetime & expired dangling pointer) without errors', () => {
    const res = summarizeValidation(fixtureH_newDelete);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects null or non-object trace', () => {
    expect(summarizeValidation(null).isValid).toBe(false);
    expect(summarizeValidation(undefined).isValid).toBe(false);
    expect(summarizeValidation('trace').isValid).toBe(false);
  });

  it('rejects trace with missing steps', () => {
    const invalidTrace = {
      schemaVersion: '0.2',
      traceId: 'test',
      source: { language: 'cpp', text: 'int main(){}' },
      producer: { kind: 'fixture', name: 'test' },
      outcome: 'completed',
      steps: 'not-an-array',
      diagnostics: [],
    };
    const res = summarizeValidation(invalidTrace);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('steps'))).toBe(true);
  });

  it('detects contradictory null pointer claiming nonzero address', () => {
    const traceCopy = JSON.parse(JSON.stringify(fixtureA_basicMutation)) as ExecutionTrace;
    traceCopy.steps[1].frames[0].variables.push({
      id: 'var-bad-p',
      name: { value: 'bad_p', provenance: 'fixture-authored' },
      type: { value: 'int*', provenance: 'fixture-authored' },
      role: 'local',
      value: {
        kind: 'pointer',
        display: '0x123',
        addressValue: { value: '0x123', provenance: 'fixture-authored' },
        resolution: { status: 'null', provenance: 'fixture-authored' },
        availability: { status: 'available' },
        provenance: 'fixture-authored',
      },
    });

    const res = summarizeValidation(traceCopy);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('pointer.null-contradiction'))).toBe(true);
  });

  it('detects unproven expired pointer target', () => {
    const traceCopy = JSON.parse(JSON.stringify(fixtureA_basicMutation)) as ExecutionTrace;
    traceCopy.steps[1].frames[0].variables.push({
      id: 'var-bad-dangling',
      name: { value: 'p', provenance: 'fixture-authored' },
      type: { value: 'int*', provenance: 'fixture-authored' },
      role: 'local',
      value: {
        kind: 'pointer',
        display: '0x5000',
        addressValue: { value: '0x5000', provenance: 'fixture-authored' },
        resolution: {
          status: 'expired-by-observed-lifetime',
          targetStorageId: 'non-existent-storage',
          provenance: 'fixture-authored',
        },
        availability: { status: 'available' },
        provenance: 'fixture-authored',
      },
    });

    const res = summarizeValidation(traceCopy);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.includes('lifetime.unproven') || e.includes('reference.target-missing'))).toBe(true);
  });
});
