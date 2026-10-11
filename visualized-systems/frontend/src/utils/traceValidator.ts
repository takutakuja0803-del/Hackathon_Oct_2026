/**
 * Visualized GDB — ExecutionTrace Validator (Canonical v0.2 Re-export)
 *
 * Source of truth: packages/execution-trace
 */

import { validateExecutionTrace, assertValidExecutionTrace, ValidationIssue } from '@visualized-gdb/execution-trace';

export { validateExecutionTrace, assertValidExecutionTrace };
export type { ValidationIssue };

export interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

/**
 * Convenience helper for UI components that summarizes canonical issues.
 */
export function summarizeValidation(input: unknown): ValidationSummary {
  const issues = validateExecutionTrace(input);
  const errors = issues
    .filter((i) => i.severity === 'error')
    .map((i) => `${i.path} [${i.code}]: ${i.message}`);
  const warnings = issues
    .filter((i) => i.severity === 'warning')
    .map((i) => `${i.path} [${i.code}]: ${i.message}`);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}
