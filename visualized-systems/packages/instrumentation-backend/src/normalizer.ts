import type {
  ExecutionTrace,
  ExecutionStep,
  StackFrame,
  Variable,
  StorageObject,
  RuntimeValue,
} from '../../execution-trace/src/index.ts';
import {
  validateExecutionTrace,
  assertValidExecutionTrace,
} from '../../execution-trace/src/index.ts';
import type { RawStepRecord, RawVariableRecord, RawArrayElementRecord } from './types.ts';

export function normalizeRawStepsToTrace(
  rawSteps: RawStepRecord[],
  sourceText: string,
  stdout = '',
  stderr = ''
): ExecutionTrace {
  const traceId = `live-trace-${Date.now()}`;

  // Pass 1: Build a global map from normalized hex address -> storageId
  const addrToStorageId = new Map<string, string>();

  for (const step of rawSteps) {
    for (const frame of step.frames) {
      for (const v of frame.variables) {
        if (v.isArray && v.arrayElements) {
          v.arrayElements.forEach((elem, idx) => {
            const normAddr = normalizeAddress(elem.address);
            if (!addrToStorageId.has(normAddr)) {
              addrToStorageId.set(normAddr, `storage-${frame.functionName}-${v.name}-${idx}`);
            }
          });
        } else if (!v.isReference) {
          const normAddr = normalizeAddress(v.address);
          if (!addrToStorageId.has(normAddr)) {
            addrToStorageId.set(normAddr, `storage-${frame.functionName}-${v.name}`);
          }
        }
      }
    }
  }

  // Pass 2: Normalize steps
  const steps: ExecutionStep[] = rawSteps.map((rawStep, stepIdx) => {
    const storageMap = new Map<string, StorageObject>();
    const frames: StackFrame[] = [];

    for (const rawFrame of rawStep.frames) {
      const frameVars: Variable[] = [];

      for (const rawVar of rawFrame.variables) {
        if (rawVar.isArray && rawVar.arrayElements) {
          // Array variable
          const elements: Variable[] = rawVar.arrayElements.map((elem, idx) => {
            const elemStorageId = `storage-${rawFrame.functionName}-${rawVar.name}-${idx}`;
            const scalarVal: RuntimeValue = {
              kind: 'scalar',
              display: String(elem.scalarValue),
              encoding: 'decimal',
              availability: { status: 'available' },
              provenance: 'instrumentation-tracked',
            };

            // Register array element storage object
            if (!storageMap.has(elemStorageId)) {
              storageMap.set(elemStorageId, {
                id: elemStorageId,
                kind: 'stack',
                address: { value: elem.address, provenance: 'instrumentation-tracked' },
                sizeBytes: { value: elem.size_bytes || 4, provenance: 'instrumentation-tracked' },
                type: { value: 'int', provenance: 'instrumentation-tracked' },
                lifetime: 'live',
                provenance: 'instrumentation-tracked',
                value: scalarVal,
              });
            } else {
              // Update value in storage object
              const st = storageMap.get(elemStorageId)!;
              st.value = scalarVal;
            }

            return {
              id: `var-${rawFrame.functionName}-${rawVar.name}-${idx}`,
              name: { value: elem.name, provenance: 'instrumentation-tracked' },
              type: { value: 'int', provenance: 'instrumentation-tracked' },
              role: 'element',
              storageId: elemStorageId,
              address: { value: elem.address, provenance: 'instrumentation-tracked' },
              value: scalarVal,
            };
          });

          frameVars.push({
            id: `var-${rawFrame.functionName}-${rawVar.name}`,
            name: { value: rawVar.name, provenance: 'instrumentation-tracked' },
            type: { value: rawVar.type, provenance: 'instrumentation-tracked' },
            role: rawVar.role === 'parameter' ? 'parameter' : 'local',
            value: {
              kind: 'array',
              extent: {
                value: rawVar.arrayExtent || rawVar.arrayElements.length,
                provenance: 'instrumentation-tracked',
              },
              elements,
              availability: { status: 'available' },
              provenance: 'instrumentation-tracked',
            },
          });
        } else if (rawVar.isReference) {
          // Reference variable: aliases target storage without duplicate storage object
          const normAddr = normalizeAddress(rawVar.address);
          const targetStorageId =
            addrToStorageId.get(normAddr) ||
            (rawVar.refTargetName
              ? `storage-${rawFrame.functionName}-${rawVar.refTargetName}`
              : `storage-target-${rawVar.name}`);

          const refValue: RuntimeValue = {
            kind: 'reference',
            display: `aliases ${rawVar.refTargetName || 'target'}`,
            target: {
              status: 'resolved',
              targetStorageId,
              offsetBytes: 0,
              provenance: 'instrumentation-tracked',
            },
            availability: { status: 'available' },
            provenance: 'instrumentation-tracked',
          };

          frameVars.push({
            id: `var-${rawFrame.functionName}-${rawVar.name}`,
            name: { value: rawVar.name, provenance: 'instrumentation-tracked' },
            type: { value: rawVar.type, provenance: 'instrumentation-tracked' },
            role: rawVar.role === 'parameter' ? 'parameter' : 'local',
            storageId: targetStorageId,
            value: refValue,
          });
        } else {
          // Scalar or pointer variable
          const normAddr = normalizeAddress(rawVar.address);
          const storageId =
            addrToStorageId.get(normAddr) || `storage-${rawFrame.functionName}-${rawVar.name}`;

          const runtimeVal = buildScalarOrPointerValue(rawVar, addrToStorageId);

          if (!storageMap.has(storageId)) {
            storageMap.set(storageId, {
              id: storageId,
              kind: 'stack',
              address: { value: rawVar.address, provenance: 'instrumentation-tracked' },
              sizeBytes: { value: rawVar.sizeBytes, provenance: 'instrumentation-tracked' },
              type: { value: rawVar.type, provenance: 'instrumentation-tracked' },
              lifetime: 'live',
              provenance: 'instrumentation-tracked',
              value: runtimeVal,
            });
          } else {
            const st = storageMap.get(storageId)!;
            st.value = runtimeVal;
          }

          frameVars.push({
            id: `var-${rawFrame.functionName}-${rawVar.name}`,
            name: { value: rawVar.name, provenance: 'instrumentation-tracked' },
            type: { value: rawVar.type, provenance: 'instrumentation-tracked' },
            role: rawVar.role === 'parameter' ? 'parameter' : 'local',
            storageId,
            address: { value: rawVar.address, provenance: 'instrumentation-tracked' },
            value: runtimeVal,
          });
        }
      }

      frames.push({
        id: rawFrame.id,
        functionName: { value: rawFrame.functionName, provenance: 'instrumentation-tracked' },
        location: {
          status: 'known',
          line: { value: rawFrame.locationLine, provenance: 'instrumentation-tracked' },
        },
        variables: frameVars,
      });
    }

    return {
      index: stepIdx,
      location: {
        status: 'known',
        line: { value: rawStep.line, provenance: 'instrumentation-tracked' },
      },
      stop: {
        reason: 'step',
        description: rawStep.description,
      },
      frames,
      storage: Array.from(storageMap.values()),
      stdout: stepIdx === rawSteps.length - 1 ? stdout : '',
      stderr: stepIdx === rawSteps.length - 1 ? stderr : '',
      observations: {
        completeness: 'partial',
        notes: ['Execution tracked natively via compiler instrumentation on macOS arm64.'],
      },
    };
  });

  const trace: ExecutionTrace = {
    schemaVersion: '0.2',
    traceId,
    source: {
      language: 'cpp',
      standard: 'c++20',
      text: sourceText,
    },
    producer: {
      kind: 'lldb',
      name: 'vgdb-clang-instrumented',
      version: '0.2.0',
    },
    outcome: 'completed',
    steps,
    diagnostics: [],
  };

  // Validate trace
  const issues = validateExecutionTrace(trace);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Constructed trace failed canonical validation: ${errors
        .map((e) => `${e.path} ${e.code}: ${e.message}`)
        .join('; ')}`
    );
  }

  assertValidExecutionTrace(trace);
  return trace;
}

function buildScalarOrPointerValue(
  rawVar: RawVariableRecord,
  addrToStorageId: Map<string, string>
): RuntimeValue {
  if (rawVar.isPointer) {
    const isNull =
      rawVar.isNull ||
      rawVar.pointerValue === '0x0' ||
      normalizeAddress(rawVar.pointerValue || '') === '0';

    if (isNull) {
      return {
        kind: 'pointer',
        display: '0x0',
        addressValue: { value: '0x0', provenance: 'instrumentation-tracked' },
        resolution: { status: 'null', provenance: 'instrumentation-tracked' },
        availability: { status: 'available' },
        provenance: 'instrumentation-tracked',
      };
    }

    const ptrAddr = rawVar.pointerValue || '0x0';
    const normPtrAddr = normalizeAddress(ptrAddr);
    const targetStorageId = addrToStorageId.get(normPtrAddr);

    if (targetStorageId) {
      return {
        kind: 'pointer',
        display: ptrAddr,
        addressValue: { value: ptrAddr, provenance: 'instrumentation-tracked' },
        resolution: {
          status: 'resolved',
          targetStorageId,
          offsetBytes: 0,
          provenance: 'instrumentation-tracked',
        },
        availability: { status: 'available' },
        provenance: 'instrumentation-tracked',
      };
    }

    return {
      kind: 'pointer',
      display: ptrAddr,
      addressValue: { value: ptrAddr, provenance: 'instrumentation-tracked' },
      resolution: {
        status: 'unresolved',
        reason: 'Pointer address does not match any observed storage object in this snapshot',
        provenance: 'instrumentation-tracked',
      },
      availability: { status: 'available' },
      provenance: 'instrumentation-tracked',
    };
  }

  // Scalar int
  return {
    kind: 'scalar',
    display: String(rawVar.scalarValue ?? 0),
    encoding: 'decimal',
    availability: { status: 'available' },
    provenance: 'instrumentation-tracked',
  };
}

function normalizeAddress(v: string): string {
  return v.toLowerCase().replace(/^0x/, '').replace(/^0+/, '') || '0';
}
