import type { Variable } from "@visualized-gdb/execution-trace";
import { getEvidenceValue as evidence } from "../../utils/deltaDerivation";
import { nameOf } from "../../utils/memoryPresentation";
import { RenderBoxValue } from "./MemoryBox";
export function ArrayMemoryBox({
  variable,
  activeDeltaTargetIds = new Set<string>(),
}: {
  variable: Variable;
  activeDeltaTargetIds?: Set<string>;
}) {
  if (variable.value.kind !== "array") return null;
  return (
    <div className="array-object">
      <div className="object-name">
        <strong>{nameOf(variable)}</strong>
        <span>{evidence<string>(variable.type) ?? "Type unknown"}</span>
      </div>
      <div className="array-cells" data-storage-id={variable.storageId}>
        {variable.value.elements.map((e, i) => (
          <div
            key={e.id}
            className={`array-cell ${activeDeltaTargetIds.has(e.id) ? "changed" : ""}`}
            data-storage-id={e.storageId}
          >
            <div className="array-index">[{i}]</div>
            <div className="cell-value" data-var-id={e.id}>
              <RenderBoxValue value={e.value} />
            </div>
            <div className="cell-address">
              {evidence<string>(e.address) ?? "Address unknown"}
            </div>
          </div>
        ))}
      </div>
      <p className="array-note">
        Adjacent elements ·{" "}
        {evidence<number>(variable.value.extent) ?? "Unknown"} declared extent
      </p>
    </div>
  );
}
