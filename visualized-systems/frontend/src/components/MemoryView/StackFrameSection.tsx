import type {
  StackFrame,
  StorageObject,
  Variable,
} from "@visualized-gdb/execution-trace";
import { getEvidenceValue as evidence } from "../../utils/deltaDerivation";
import { nameOf } from "../../utils/memoryPresentation";
import { MemoryBox } from "./MemoryBox";
import { ArrayMemoryBox } from "./ArrayMemoryBox";
export function StackFrameSection({
  frames,
  storageObjects,
  activeDeltaTargetIds = new Set<string>(),
  slots = new Map<string, string[]>(),
  aliases = new Map<string, string[]>(),
}: {
  frames: StackFrame[];
  storageObjects: StorageObject[];
  activeDeltaTargetIds?: Set<string>;
  slots?: Map<string, string[]>;
  aliases?: Map<string, string[]>;
}) {
  const renderVariable = (v: Variable): React.ReactNode => {
    if (v.value.kind === "reference")
      return (
        <div className="unresolved-alias">
          {nameOf(v)} · alias target {v.value.target.status}
        </div>
      );
    if (v.value.kind === "array")
      return (
        <ArrayMemoryBox
          variable={v}
          activeDeltaTargetIds={activeDeltaTargetIds}
        />
      );
    if (v.value.kind === "aggregate")
      return (
        <div className="aggregate-object">
          <div className="object-name">{nameOf(v)}</div>
          <div className="object-row">
            {v.value.children.map((c) => (
              <div key={c.id}>{renderVariable(c)}</div>
            ))}
          </div>
        </div>
      );
    const storage = storageObjects.find((s) => s.id === v.storageId);
    return (
      <MemoryBox
        varId={v.id}
        storageId={v.storageId}
        name={nameOf(v)}
        type={evidence<string>(v.type) ?? "Type unknown"}
        address={
          evidence<string>(v.address) ?? evidence<string>(storage?.address)
        }
        value={v.value}
        role={v.role}
        aliasNames={aliases.get(v.storageId ?? "")}
        isMutated={activeDeltaTargetIds.has(v.id)}
        isExpired={storage?.lifetime === "ended"}
      />
    );
  };
  return (
    <div className="frame-stack">
      {frames.length === 0 && (
        <p className="empty-note">No frames in this snapshot.</p>
      )}
      {frames.map((frame, i) => {
        const visible = frame.variables.filter(
          (v) =>
            v.value.kind !== "reference" ||
            v.value.target.status !== "resolved" ||
            !aliases.has(v.value.target.targetStorageId),
        );
        const order = [
          ...new Set([
            ...(slots.get(frame.id) ?? []),
            ...visible.map((v) => v.id),
          ]),
        ];
        return (
          <section
            className={`stack-frame ${i === 0 ? "current-frame" : ""} ${order.length === 1 ? "single-object-frame" : ""}`}
            key={frame.id}
            data-frame-id={frame.id}
          >
            <div className="frame-heading">
              <h3>
                {evidence<string>(frame.functionName) ?? "Unknown function"}()
              </h3>
              <span>{i === 0 ? "Current function" : "Caller"}</span>
            </div>
            <div className="object-row">
              {order.map((id) => {
                const v = visible.find((v) => v.id === id);
                return v ? (
                  <div className="object-slot" key={id}>
                    {renderVariable(v)}
                  </div>
                ) : (
                  <div
                    className="object-slot reserved-slot"
                    key={id}
                    aria-hidden="true"
                  />
                );
              })}
            </div>
            {visible.length === 0 && (
              <p className="empty-note">No visible locals.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
