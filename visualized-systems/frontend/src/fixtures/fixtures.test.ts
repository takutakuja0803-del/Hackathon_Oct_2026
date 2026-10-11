import { describe, it, expect } from 'vitest';
import { GOLDEN_FIXTURES } from './index';
import { validateExecutionTrace } from '@visualized-gdb/execution-trace';

describe('Golden Fixtures Canonical v0.2 Validation Suite', () => {
  GOLDEN_FIXTURES.forEach((fixture) => {
    it(`validates fixture ${fixture.key}: ${fixture.name} under canonical v0.2 contract`, () => {
      const issues = validateExecutionTrace(fixture.trace);
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length > 0) {
        console.error(`Validation errors in ${fixture.name}:`, errors);
      }
      expect(errors).toHaveLength(0);
      expect(fixture.trace.schemaVersion).toBe('0.2');
      expect(fixture.trace.steps.length).toBeGreaterThan(0);
    });
  });

  it('rejects an invalid trace schema version', () => {
    const invalidTrace = {
      ...GOLDEN_FIXTURES[0].trace,
      schemaVersion: '0.1',
    };
    const issues = validateExecutionTrace(invalidTrace);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors.some((e) => e.code === 'trace.version')).toBe(true);
  });
});
