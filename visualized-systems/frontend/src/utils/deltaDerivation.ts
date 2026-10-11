import { ExecutionStep, Variable, RuntimeValue, StorageObject } from '@visualized-gdb/execution-trace';

export interface DerivedDelta {
  id: string;
  kind:
    | 'frame-push'
    | 'frame-pop'
    | 'var-init'
    | 'value-mutation'
    | 'pointer-redirect'
    | 'lifetime-ended'
    | 'stdout';
  target: string;
  description: string;
  oldDisplay?: string;
  newDisplay?: string;
}

/**
 * Derives state mutations by comparing consecutive ExecutionStep snapshots.
 * Adheres strictly to the canonical v0.2 model (no manual fixture delta logs).
 */
export function deriveStepDeltas(
  currentStep: ExecutionStep,
  prevStep: ExecutionStep | null
): DerivedDelta[] {
  const deltas: DerivedDelta[] = [];

  // Step 0: Initial state
  if (!prevStep) {
    if (currentStep.frames.length > 0) {
      const topFrame = currentStep.frames[0];
      const fnName = getEvidenceValue<string>(topFrame.functionName) || 'main';
      deltas.push({
        id: `delta-init-frame`,
        kind: 'frame-push',
        target: `${fnName}()`,
        description: `Execution stopped in initial frame ${fnName}()`,
      });
    }

    currentStep.frames.forEach((frame) => {
      frame.variables.forEach((v) => {
        const vName = getEvidenceValue<string>(v.name) || v.id;
        const valStr = formatRuntimeValue(v.value);
        deltas.push({
          id: `delta-init-var-${v.id}`,
          kind: 'var-init',
          target: vName,
          description: `${vName} in scope with value: ${valStr}`,
          newDisplay: valStr,
        });
      });
    });

    if (currentStep.stdout) {
      deltas.push({
        id: `delta-init-stdout`,
        kind: 'stdout',
        target: 'stdout',
        description: `Output emitted: ${JSON.stringify(currentStep.stdout)}`,
        newDisplay: currentStep.stdout,
      });
    }

    return deltas;
  }

  // 1. Frame push/pop detection
  const prevTopFrame = prevStep.frames[0];
  const currTopFrame = currentStep.frames[0];

  if (currTopFrame && (!prevTopFrame || currTopFrame.id !== prevTopFrame.id)) {
    const fnName = getEvidenceValue<string>(currTopFrame.functionName) || currTopFrame.id;
    if (currentStep.frames.length > prevStep.frames.length) {
      deltas.push({
        id: `delta-frame-push-${currTopFrame.id}`,
        kind: 'frame-push',
        target: `${fnName}()`,
        description: `Called ${fnName}(): pushed new stack frame`,
      });
    } else {
      deltas.push({
        id: `delta-frame-pop-${prevTopFrame?.id}`,
        kind: 'frame-pop',
        target: `${fnName}()`,
        description: `Returned to ${fnName}(): popped previous stack frame`,
      });
    }
  } else if (currentStep.frames.length < prevStep.frames.length) {
    const prevFn = getEvidenceValue<string>(prevTopFrame?.functionName) || 'function';
    deltas.push({
      id: `delta-frame-pop-${prevTopFrame?.id}`,
      kind: 'frame-pop',
      target: `${prevFn}()`,
      description: `Returned from ${prevFn}(): frame popped from stack`,
    });
  }

  // 2. Storage lifetime changes
  const prevStorageMap = new Map<string, StorageObject>(
    prevStep.storage.map((s) => [s.id, s])
  );

  currentStep.storage.forEach((currS) => {
    const prevS = prevStorageMap.get(currS.id);
    if (prevS && prevS.lifetime === 'live' && currS.lifetime === 'ended') {
      const typeStr = getEvidenceValue<string>(currS.type) || 'object';
      const addrStr = getEvidenceValue<string>(currS.address) || '';
      deltas.push({
        id: `delta-lifetime-${currS.id}`,
        kind: 'lifetime-ended',
        target: `${currS.kind} storage [${currS.id}]`,
        description: `Deallocated ${typeStr} at ${addrStr || currS.id} (lifetime ended)`,
        oldDisplay: 'live',
        newDisplay: 'ended',
      });
    }
  });

  // 3. Variable mutations across frames
  const prevVarMap = new Map<string, Variable>();
  prevStep.frames.forEach((f) => {
    f.variables.forEach((v) => prevVarMap.set(v.id, v));
  });

  currentStep.frames.forEach((frame) => {
    frame.variables.forEach((currV) => {
      const prevV = prevVarMap.get(currV.id);
      const vName = getEvidenceValue<string>(currV.name) || currV.id;

      if (!prevV) {
        // Variable newly declared/entered scope
        const newStr = formatRuntimeValue(currV.value);
        deltas.push({
          id: `delta-new-var-${currV.id}`,
          kind: 'var-init',
          target: vName,
          description: `${vName} entered scope with value: ${newStr}`,
          newDisplay: newStr,
        });
      } else {
        // Compare values
        const prevStr = formatRuntimeValue(prevV.value);
        const currStr = formatRuntimeValue(currV.value);

        if (prevStr !== currStr) {
          if (currV.value.kind === 'pointer') {
            const resStatus = currV.value.resolution.status;
            let note = `${vName} now points to ${currStr} (${resStatus})`;
            if (resStatus === 'expired-by-observed-lifetime') {
              note = `${vName} target deallocated (DANGLING POINTER)`;
            } else if (resStatus === 'null') {
              note = `${vName} assigned nullptr`;
            }
            deltas.push({
              id: `delta-ptr-${currV.id}`,
              kind: 'pointer-redirect',
              target: vName,
              description: note,
              oldDisplay: prevStr,
              newDisplay: currStr,
            });
          } else {
            deltas.push({
              id: `delta-val-${currV.id}`,
              kind: 'value-mutation',
              target: vName,
              description: `${vName} mutated: ${prevStr} -> ${currStr}`,
              oldDisplay: prevStr,
              newDisplay: currStr,
            });
          }
        }
      }
    });
  });

  // 4. Stdout changes
  if (currentStep.stdout) {
    deltas.push({
      id: `delta-stdout-${currentStep.index}`,
      kind: 'stdout',
      target: 'stdout',
      description: `Output: ${JSON.stringify(currentStep.stdout)}`,
      newDisplay: currentStep.stdout,
    });
  }

  return deltas;
}

export function formatRuntimeValue(val: RuntimeValue): string {
  switch (val.kind) {
    case 'scalar':
      return val.display;
    case 'pointer': {
      const addr = getEvidenceValue<string>(val.addressValue) || val.display || '0x?';
      if (val.resolution.status === 'null') return 'nullptr (0x0)';
      if (val.resolution.status === 'expired-by-observed-lifetime') {
        return `${addr} [DANGLING]`;
      }
      if (val.resolution.status === 'resolved') {
        return `${addr} -> ${val.resolution.targetStorageId}`;
      }
      return `${addr} (${val.resolution.status})`;
    }
    case 'reference': {
      if (val.target.status === 'resolved') {
        return `alias of ${val.target.targetStorageId}`;
      }
      return `ref (${val.target.status})`;
    }
    case 'array': {
      const elems = val.elements.map((e) => formatRuntimeValue(e.value)).join(', ');
      return `[${elems}]`;
    }
    case 'aggregate': {
      const fields = val.children
        .map((c) => `${getEvidenceValue<string>(c.name) || '?'}: ${formatRuntimeValue(c.value)}`)
        .join(', ');
      return `{ ${fields} }`;
    }
    case 'unavailable': {
      const avail = val.availability;
      const detail = 'reason' in avail ? avail.reason : 'message' in avail ? avail.message : '';
      return `[${avail.status.toUpperCase()}: ${detail}]`;
    }
    default:
      return '?';
  }
}

export function getEvidenceValue<T>(field: unknown): T | undefined {
  if (field && typeof field === 'object' && 'value' in field) {
    return (field as { value: T }).value;
  }
  return undefined;
}
