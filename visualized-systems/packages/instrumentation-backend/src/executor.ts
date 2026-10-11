import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type { RawStepRecord } from './types.ts';

export interface ExecuteResult {
  success: boolean;
  steps?: RawStepRecord[];
  stdout: string;
  stderr: string;
  error?: string;
}

export async function executeInstrumentedProgram(
  executablePath: string,
  tempDir: string,
  timeoutMs = 5000
): Promise<ExecuteResult> {
  const traceOutputPath = path.join(tempDir, 'trace.json');

  try {
    return await new Promise<ExecuteResult>((resolve) => {
      execFile(
        executablePath,
        [],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            VGDB_OUTPUT_FILE: traceOutputPath,
          },
          timeout: timeoutMs, // 5s execution timeout
          maxBuffer: 64 * 1024, // 64KB max output buffer
        },
        (err: Error | null, stdout: string, stderr: string) => {
          let steps: RawStepRecord[] = [];
          let readError: string | undefined = undefined;

          if (fs.existsSync(traceOutputPath)) {
            try {
              const rawJson = fs.readFileSync(traceOutputPath, 'utf-8');
              steps = JSON.parse(rawJson);
            } catch (parseErr: any) {
              readError = `Failed to parse trace JSON: ${parseErr.message}`;
            }
          } else if (!err) {
            readError = 'Program executed but did not emit trace output.';
          }

          // Clean up tempDir
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch {
            // Ignore cleanup errors
          }

          if (err) {
            if ((err as any).killed) {
              resolve({
                success: false,
                stdout: stdout || '',
                stderr: stderr || '',
                error: `Execution timed out (${timeoutMs}ms limit exceeded).`,
              });
            } else {
              resolve({
                success: false,
                stdout: stdout || '',
                stderr: stderr || '',
                error: err.message,
              });
            }
          } else if (readError) {
            resolve({
              success: false,
              stdout: stdout || '',
              stderr: stderr || '',
              error: readError,
            });
          } else {
            resolve({
              success: true,
              steps,
              stdout: stdout || '',
              stderr: stderr || '',
            });
          }
        }
      );
    });
  } catch (err: any) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: err.message || 'Execution failed',
    };
  }
}
