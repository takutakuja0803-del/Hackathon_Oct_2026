import type { RuntimeValue, Provenance } from "@visualized-gdb/execution-trace";
import { valueText } from "../../utils/memoryPresentation";
export interface MemoryBoxProps {
  name: string;
  type: string;
  address?: string | null;
  value: RuntimeValue;
  storageId?: string;
  varId?: string;
  role?: string;
  aliasNames?: string[];
  isMutated?: boolean;
  isExpired?: boolean;
  provenance?: Provenance;
}
export function MemoryBox({
  name,
  type,
  address,
  value,
  storageId,
  varId,
  role,
  aliasNames = [],
  isMutated = false,
  isExpired = false,
}: MemoryBoxProps) {
  const pointer = value.kind === "pointer";
  return (
    <div
      className={`memory-object ${pointer ? "pointer-object" : ""}`}
      data-object-id={varId ?? storageId}
    >
      <div className="object-name">
        <strong>{name}</strong>
        <span>
          {type}
          {role === "parameter" ? " · parameter" : ""}
        </span>
      </div>
      <div
        data-storage-id={storageId}
        className={`memory-cell ${isMutated ? "changed" : ""} ${isExpired ? "ended" : ""}`}
      >
        <div className="cell-value" data-var-id={varId}>
          <RenderBoxValue value={value} isExpired={isExpired} />
        </div>
        <div className="cell-address">{address ?? "Address unknown"}</div>
      </div>
      <div className="cell-caption">
        {isExpired
          ? "Lifetime ended"
          : isMutated
            ? "Changed this step"
            : pointer
              ? "Stores an address"
              : "\u00a0"}
      </div>
      {aliasNames.length > 0 && (
        <div className="alias-label">
          also named <strong>{aliasNames.join(", ")}</strong>
          <span>same object</span>
        </div>
      )}
    </div>
  );
}
export function RenderBoxValue({
  value,
  isExpired,
}: {
  value: RuntimeValue;
  isExpired?: boolean;
}) {
  if (isExpired) return <span className="unknown-value">Lifetime ended</span>;
  if (value.kind === "unavailable")
    return (
      <span
        className="unknown-value"
        title={
          "reason" in value.availability
            ? value.availability.reason
            : "message" in value.availability
              ? value.availability.message
              : ""
        }
      >
        {valueText(value)}
      </span>
    );
  return (
    <>
      <span
        className={value.kind === "pointer" ? "pointer-value" : "literal-value"}
      >
        {valueText(value)}
      </span>
      {value.kind === "pointer" &&
        value.resolution.status !== "resolved" &&
        value.resolution.status !== "null" && (
          <small className="resolution-label">
            {value.resolution.status === "expired-by-observed-lifetime"
              ? "Dangling pointer"
              : value.resolution.status}
          </small>
        )}
    </>
  );
}
