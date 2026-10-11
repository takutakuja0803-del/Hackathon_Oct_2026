import type { TraceOptions, TraceResult } from './types.ts';
import { parseAndValidateSource } from './parser.ts';
import { generateInstrumentedCode } from './instrumenter.ts';
import { compileInstrumentedCode } from './compiler.ts';
import { executeInstrumentedProgram } from './executor.ts';
import { normalizeRawStepsToTrace } from './normalizer.ts';

export type * from './types.ts';
export * from './parser.ts';
export * from './instrumenter.ts';
export * from './compiler.ts';
export * from './executor.ts';
export * from './normalizer.ts';

export async function traceCppCode(
  source: string,
  options: TraceOptions = {}
): Promise<TraceResult> {
  // Phase 1: Parse and validate source code
  const parseResult = parseAndValidateSource(source);
  if (!parseResult.success) {
    return {
      success: false,
      diagnostics: parseResult.diagnostics,
      error: parseResult.diagnostics[0]?.message || 'Parsing failed',
    };
  }

  // Phase 2: Instrument source code
  const instrumented = generateInstrumentedCode(parseResult.functions);

  // Phase 3: Compile with clang++
  const compileResult = await compileInstrumentedCode(
    instrumented.code,
    options.compilerPath || '/usr/bin/clang++'
  );
  if (!compileResult.success) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'compiler.error',
          message: compileResult.error || 'Clang compilation failed',
          provenance: 'backend-inferred',
        },
      ],
      error: compileResult.error || 'Clang compilation failed',
    };
  }

  // Phase 4: Execute instrumented binary
  const execResult = await executeInstrumentedProgram(
    compileResult.executablePath!,
    compileResult.tempDir,
    options.timeoutMs || 5000
  );
  if (!execResult.success || !execResult.steps) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'runtime.error',
          message: execResult.error || 'Program execution failed',
          provenance: 'backend-inferred',
        },
      ],
      error: execResult.error || 'Program execution failed',
    };
  }

  // Phase 5: Normalize raw steps to canonical ExecutionTrace v0.2
  try {
    const trace = normalizeRawStepsToTrace(
      execResult.steps,
      source,
      execResult.stdout,
      execResult.stderr
    );
    return {
      success: true,
      trace,
      diagnostics: [],
    };
  } catch (normErr: any) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'normalization.error',
          message: normErr.message || 'Trace normalization failed',
          provenance: 'backend-inferred',
        },
      ],
      error: normErr.message || 'Trace normalization failed',
    };
  }
}
