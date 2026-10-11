import type {
  StorageObject,
  RuntimeValue,
} from "@visualized-gdb/execution-trace";
import { getEvidenceValue as evidence } from "../../utils/deltaDerivation";
import { MemoryBox } from "./MemoryBox";
export function HeapSection({
  storageObjects,
  activeDeltaTargetIds = new Set<string>(),
  aliases = new Map<string, string[]>(),
}: {
  storageObjects: StorageObject[];
  activeDeltaTargetIds?: Set<string>;
  aliases?: Map<string, string[]>;
}) {
  const heap = storageObjects.filter((s) => s.kind === "heap");
  return (
    <section className={`heap-region ${heap.length ? "has-heap" : ""}`}>
      <div className="region-heading">
        <h2>Heap</h2>
        <span>Dynamic storage</span>
      </div>
      {heap.length ? (
        <div className="heap-objects">
          {heap.map((s) => {
            const value: RuntimeValue = s.value ?? {
              kind: "unavailable",
              availability: {
                status: "unknown",
                reason: "No payload in snapshot",
              },
              provenance: "unknown",
            };
            return (
              <MemoryBox
                key={s.id}
                storageId={s.id}
                name="allocation"
                type={evidence<string>(s.type) ?? "Type unknown"}
                address={evidence<string>(s.address)}
                value={value}
                isExpired={s.lifetime === "ended"}
                isMutated={activeDeltaTargetIds.has(s.id)}
                aliasNames={aliases.get(s.id)}
              />
            );
          })}
        </div>
      ) : (
        <p className="empty-note">No allocations shown in this snapshot.</p>
      )}
    </section>
  );
}
