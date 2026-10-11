import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CompileResult {
  success: boolean;
  tempDir: string;
  executablePath?: string;
  error?: string;
}

export async function compileInstrumentedCode(
  code: string,
  compilerPath = '/usr/bin/clang++'
): Promise<CompileResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vgdb-build-'));

  try {
    // Write runtime.hpp
    const runtimeHppPath = path.join(__dirname, 'runtime.hpp');
    const targetRuntimePath = path.join(tempDir, 'runtime.hpp');
    if (fs.existsSync(runtimeHppPath)) {
      fs.copyFileSync(runtimeHppPath, targetRuntimePath);
    } else {
      // In case running from dist, look in src
      const altRuntimePath = path.join(__dirname, '../src/runtime.hpp');
      if (fs.existsSync(altRuntimePath)) {
        fs.copyFileSync(altRuntimePath, targetRuntimePath);
      } else {
        throw new Error('Could not locate runtime.hpp header');
      }
    }

    // Write main.cpp
    const mainCppPath = path.join(tempDir, 'main.cpp');
    fs.writeFileSync(mainCppPath, code, 'utf-8');

    const executablePath = path.join(tempDir, 'program');

    // Compile using execFile with argument array (NO shell interpolation)
    const compileArgs = ['-std=c++20', '-O0', '-I.', '-o', 'program', 'main.cpp'];

    return await new Promise<CompileResult>((resolve) => {
      execFile(
        compilerPath,
        compileArgs,
        {
          cwd: tempDir,
          timeout: 10000, // 10s compile timeout
          maxBuffer: 1024 * 1024,
        },
        (err: Error | null, _stdout: string, stderr: string) => {
          if (err) {
            resolve({
              success: false,
              tempDir,
              error: stderr || err.message,
            });
          } else {
            resolve({
              success: true,
              tempDir,
              executablePath,
            });
          }
        }
      );
    });
  } catch (err: any) {
    return {
      success: false,
      tempDir,
      error: err.message || 'Compilation setup failed',
    };
  }
}
