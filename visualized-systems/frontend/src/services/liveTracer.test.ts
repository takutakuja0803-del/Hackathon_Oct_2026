import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestLiveTrace } from './liveTracer';

describe('requestLiveTrace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates and accepts valid live execution traces', async () => {
    const mockTrace = {
      schemaVersion: '0.2',
      traceId: 'test-trace',
      source: { language: 'cpp', text: 'int main() {\n    int x = 5;\n}' },
      producer: { kind: 'lldb', name: 'vgdb-clang-instrumented', version: '0.2.0' },
      outcome: 'completed',
      steps: [
        {
          index: 0,
          location: {
            status: 'known',
            line: { value: 2, provenance: 'instrumentation-tracked' },
          },
          stop: { reason: 'step', description: 'Initialized x = 5' },
          frames: [
            {
              id: 'frame-main-0',
              functionName: { value: 'main', provenance: 'instrumentation-tracked' },
              location: {
                status: 'known',
                line: { value: 2, provenance: 'instrumentation-tracked' },
              },
              variables: [
                {
                  id: 'var-main-x',
                  name: { value: 'x', provenance: 'instrumentation-tracked' },
                  type: { value: 'int', provenance: 'instrumentation-tracked' },
                  role: 'local',
                  storageId: 'storage-main-x',
                  address: { value: '0x1000', provenance: 'instrumentation-tracked' },
                  value: {
                    kind: 'scalar',
                    display: '5',
                    encoding: 'decimal',
                    availability: { status: 'available' },
                    provenance: 'instrumentation-tracked',
                  },
                },
              ],
            },
          ],
          storage: [
            {
              id: 'storage-main-x',
              kind: 'stack',
              address: { value: '0x1000', provenance: 'instrumentation-tracked' },
              sizeBytes: { value: 4, provenance: 'instrumentation-tracked' },
              type: { value: 'int', provenance: 'instrumentation-tracked' },
              lifetime: 'live',
              provenance: 'instrumentation-tracked',
              value: {
                kind: 'scalar',
                display: '5',
                encoding: 'decimal',
                availability: { status: 'available' },
                provenance: 'instrumentation-tracked',
              },
            },
          ],
          stdout: '',
          stderr: '',
          observations: {
            completeness: 'partial',
            notes: [],
          },
        },
      ],
      diagnostics: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, trace: mockTrace, diagnostics: [] }),
    });

    const res = await requestLiveTrace('int main() {\n    int x = 5;\n}');
    expect(res.success).toBe(true);
    expect(res.trace).toBeDefined();
    expect(res.trace?.steps.length).toBe(1);
  });

  it('rejects malformed traces that violate canonical contract', async () => {
    const invalidTrace = {
      schemaVersion: '0.1', // Invalid version!
      traceId: 'bad-trace',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, trace: invalidTrace }),
    });

    const res = await requestLiveTrace('int main() {}');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/validation/i);
  });

  it('surfaces backend compiler diagnostics on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        diagnostics: [
          {
            severity: 'error',
            code: 'compiler.error',
            message: 'error: expected expression',
            provenance: 'backend-inferred',
          },
        ],
        error: 'Compilation failed',
      }),
    });

    const res = await requestLiveTrace('int main() { int x = ; }');
    expect(res.success).toBe(false);
    expect(res.diagnostics.length).toBe(1);
    expect(res.diagnostics[0].message).toContain('expected expression');
  });
});
