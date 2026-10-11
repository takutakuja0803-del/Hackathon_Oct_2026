import {
  ExecutionTrace,
  TraceDiagnostic,
  validateExecutionTrace,
} from '@visualized-gdb/execution-trace';

export interface LiveTraceResponse {
  success: boolean;
  trace?: ExecutionTrace;
  diagnostics: TraceDiagnostic[];
  error?: string;
}

export async function requestLiveTrace(code: string): Promise<LiveTraceResponse> {
  try {
    const res = await fetch('/api/visualize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok && res.status !== 400 && res.status !== 500) {
      return {
        success: false,
        diagnostics: [
          {
            severity: 'error',
            code: 'network.error',
            message: `Server returned HTTP status ${res.status}: ${res.statusText}`,
            provenance: 'backend-inferred',
          },
        ],
        error: `Server request failed with status ${res.status}`,
      };
    }

    const data: LiveTraceResponse = await res.json();
    if (data.success && data.trace) {
      // Ensure canonical ExecutionTrace v0.2 validator passes before returning
      const issues = validateExecutionTrace(data.trace);
      const errors = issues.filter((i) => i.severity === 'error');
      if (errors.length > 0) {
        return {
          success: false,
          diagnostics: errors.map((e) => ({
            severity: 'error',
            code: e.code,
            message: `Validation failed: ${e.message}`,
            provenance: 'backend-inferred',
          })),
          error: 'Generated execution trace failed canonical v0.2 validation.',
        };
      }
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'client.network-failure',
          message: err.message || 'Failed to connect to local compilation backend.',
          provenance: 'backend-inferred',
        },
      ],
      error: err.message || 'Failed to connect to local compilation backend.',
    };
  }
}
