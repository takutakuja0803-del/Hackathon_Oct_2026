/** ExecutionTrace v0.2: the sole runtime-state boundary for every producer. */
export const EXECUTION_TRACE_VERSION = "0.2" as const;

export type Provenance =
  | "debugger-observed"
  | "backend-inferred"
  | "instrumentation-tracked"
  | "fixture-authored"
  | "unknown";

export type Availability =
  | { status: "available" }
  | { status: "unknown"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string; code?: string };

export interface Evidence<T> {
  value: T;
  provenance: Provenance;
}

export type SourceLocation = {
  status: "known";
  file?: Evidence<string>;
  line: Evidence<number>; // positive, 1-based source line
  column?: Evidence<number>; // positive, 1-based source column
} | {
  status: "unknown" | "unavailable";
  reason: string;
};

export interface TraceDiagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  provenance: Provenance;
  stepIndex?: number;
}

export interface ExecutionTrace {
  schemaVersion: typeof EXECUTION_TRACE_VERSION;
  traceId: string;
  source: { language: "cpp"; text: string; standard?: string };
  producer: {
    kind: "lldb" | "fixture";
    name: string;
    version?: string;
    target?: string;
  };
  outcome: "completed" | "compile-error" | "runtime-error" | "stopped" | "limit-reached" | "unknown";
  steps: ExecutionStep[];
  diagnostics: TraceDiagnostic[];
}

export interface ExecutionStep {
  index: number; // contiguous, zero-based; one state snapshot at an intentional stop
  location: SourceLocation;
  stop: { reason: "breakpoint" | "step" | "entry" | "exit" | "signal" | "exception" | "unknown"; description?: string };
  frames: StackFrame[]; // innermost/current frame first
  storage: StorageObject[]; // known addressable objects only; not a process heap census
  stdout: string; // bytes/text appended since prior snapshot, decoded as UTF-8 where possible
  stderr: string;
  observations: ObservationSummary;
}

export interface ObservationSummary {
  completeness: "partial" | "unknown";
  notes: string[];
}

export interface StackFrame {
  id: string; // trace-local frame-instance identity, unique across this trace
  functionName: Evidence<string> | { status: "unknown" | "unavailable" | "error"; reason: string };
  location: SourceLocation;
  variables: Variable[];
}

export interface Variable {
  id: string; // trace-local variable-instance identity, distinct from address
  name: Evidence<string> | { status: "unknown" | "unavailable" | "error"; reason: string };
  type: Evidence<string> | { status: "unknown" | "unavailable" | "error"; reason: string };
  role: "local" | "parameter" | "global" | "member" | "element" | "other";
  storageId?: string; // links this variable view to a storage object when established
  address?: Evidence<string>; // observed runtime address; presentation only, not identity
  value: RuntimeValue;
}

export type RuntimeValue =
  | { kind: "scalar"; display: string; encoding?: "decimal" | "hex" | "character" | "boolean" | "string" | "other"; availability: { status: "available" }; provenance: Provenance }
  | { kind: "aggregate"; children: Variable[]; availability: { status: "available" }; provenance: Provenance }
  | { kind: "array"; elements: Variable[]; extent: Evidence<number> | { status: "unknown" | "unavailable" | "error"; reason: string }; availability: { status: "available" }; provenance: Provenance }
  | { kind: "pointer"; display: string; addressValue: Evidence<string> | { status: "unknown" | "unavailable" | "error"; reason: string }; resolution: PointerResolution; availability: { status: "available" }; provenance: Provenance }
  | { kind: "reference"; display: string; target: PointerResolution; availability: { status: "available" }; provenance: Provenance }
  | { kind: "unavailable"; availability: Exclude<Availability, { status: "available" }>; provenance: Provenance };

export type PointerResolution =
  | { status: "resolved"; targetStorageId: string; offsetBytes?: number; provenance: Provenance }
  | { status: "null"; provenance: Provenance }
  | { status: "unresolved"; reason: string; provenance: Provenance }
  | { status: "out-of-bounds"; targetStorageId: string; offsetBytes: number; provenance: Provenance }
  | { status: "expired-by-observed-lifetime"; targetStorageId: string; provenance: Provenance }
  | { status: "unknown"; reason: string; provenance: "unknown" };

export interface StorageObject {
  id: string; // trace-local identity, never derived solely from address
  kind: "stack" | "global" | "heap" | "unknown";
  address?: Evidence<string>;
  sizeBytes?: Evidence<number>;
  type?: Evidence<string>;
  lifetime: "live" | "ended" | "unknown";
  provenance: Provenance;
  value?: RuntimeValue;
}

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

/** Structural + semantic validation. Unknown is valid; contradictory facts are not. */
export function validateExecutionTrace(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (path: string, code: string, message: string) => issues.push({ path, code, message, severity: "error" as const });
  const warn = (path: string, code: string, message: string) => issues.push({ path, code, message, severity: "warning" as const });
  if (!isRecord(input)) return [{ path: "$", code: "trace.type", message: "Trace must be an object", severity: "error" }];
  if (input.schemaVersion !== EXECUTION_TRACE_VERSION) err("$.schemaVersion", "trace.version", `Expected schema version ${EXECUTION_TRACE_VERSION}`);
  if (typeof input.traceId !== "string" || !input.traceId) err("$.traceId", "trace.id", "traceId must be a non-empty string");
  if (!isRecord(input.source) || input.source.language !== "cpp" || typeof input.source.text !== "string") err("$.source", "trace.source", "source must contain language=cpp and text");
  if (!isRecord(input.producer) || !["lldb", "fixture"].includes(String(input.producer.kind)) || typeof input.producer.name !== "string") err("$.producer", "trace.producer", "producer must identify lldb or fixture and have a name");
  if (!Array.isArray(input.steps)) { err("$.steps", "trace.steps", "steps must be an array"); return issues; }
  const allStorageIds = new Set<string>();
  const stepStorageIds: Set<string>[] = [];
  input.steps.forEach((step: unknown, si: number) => {
    const p = `$.steps[${si}]`;
    if (!isRecord(step)) { err(p, "step.type", "step must be an object"); return; }
    if (step.index !== si) err(`${p}.index`, "step.index", "step indices must be contiguous and zero-based");
    if (!isLocation(step.location)) err(`${p}.location`, "location.shape", "location must be known with a line or unknown/unavailable with reason");
    if (step.location?.status === "known") {
      const n = step.location.line?.value;
      const lines = typeof input.source?.text === "string" ? sourceLineCount(input.source.text) : 0;
      if (!Number.isInteger(n) || n < 1 || n > lines) err(`${p}.location.line`, "location.range", "known line must be a 1-based line within source text");
      if (step.location.column && (!Number.isInteger(step.location.column.value) || step.location.column.value < 1)) err(`${p}.location.column`, "location.column", "known column must be a positive 1-based column");
    }
    if (!isRecord(step.stop) || !["breakpoint", "step", "entry", "exit", "signal", "exception", "unknown"].includes(String(step.stop.reason))) err(`${p}.stop`, "stop.shape", "invalid stop reason");
    const frameIds = new Set<string>();
    const variableIds = new Set<string>();
    if (!Array.isArray(step.frames)) err(`${p}.frames`, "frames.shape", "frames must be an array");
    else step.frames.forEach((frame: unknown, fi: number) => {
      const fp = `${p}.frames[${fi}]`;
      if (!isRecord(frame) || typeof frame.id !== "string" || !frame.id) { err(fp, "frame.shape", "frame requires a non-empty id"); return; }
      if (frameIds.has(frame.id)) err(`${fp}.id`, "identity.duplicate", "frame id must be unique within a step");
      frameIds.add(frame.id);
      if (!isLocation(frame.location)) err(`${fp}.location`, "location.shape", "frame location must be known with a line or unknown/unavailable with reason");
      if (frame.location?.status === "known") {
        const n = frame.location.line?.value;
        const lines = typeof input.source?.text === "string" ? sourceLineCount(input.source.text) : 0;
        if (!Number.isInteger(n) || n < 1 || n > lines) err(`${fp}.location.line`, "location.range", "known line must be a 1-based line within source text");
        if (frame.location.column && (!Number.isInteger(frame.location.column.value) || frame.location.column.value < 1)) err(`${fp}.location.column`, "location.column", "known column must be a positive 1-based column");
      }
      if (!Array.isArray(frame.variables)) { err(`${fp}.variables`, "variables.shape", "variables must be an array"); return; }
      frame.variables.forEach((v: unknown, vi: number) => validateVariable(v, `${fp}.variables[${vi}]`, err, variableIds));
    });
    const localStorageIds = new Set<string>();
    stepStorageIds[si] = localStorageIds;
    if (!Array.isArray(step.storage)) err(`${p}.storage`, "storage.shape", "storage must be an array");
    else step.storage.forEach((s: unknown, oi: number) => {
      const op = `${p}.storage[${oi}]`;
      if (!isRecord(s) || typeof s.id !== "string" || !s.id) { err(op, "storage.record", "storage requires non-empty id"); return; }
      if (localStorageIds.has(s.id)) err(`${op}.id`, "identity.duplicate", "storage id must be unique within a step");
      localStorageIds.add(s.id);
      allStorageIds.add(s.id);
      if (isEvidence(s.address) && s.id === s.address.value) err(`${op}.id`, "identity.address-alias", "storage identity must not be its runtime address");
      if (s.address !== undefined && (!isEvidence(s.address) || !isHexAddress(s.address.value))) err(`${op}.address`, "storage.address", "address must be a hexadecimal runtime address with provenance");
      if (!["stack", "global", "heap", "unknown"].includes(String(s.kind))) err(`${op}.kind`, "storage.kind", "invalid storage kind");
      if (!["live", "ended", "unknown"].includes(String(s.lifetime))) err(`${op}.lifetime`, "storage.lifetime", "invalid lifetime state");
      if (s.sizeBytes !== undefined && (!isEvidence(s.sizeBytes) || typeof s.sizeBytes.value !== "number" || !Number.isInteger(s.sizeBytes.value) || s.sizeBytes.value < 0)) err(`${op}.sizeBytes`, "storage.size", "sizeBytes must be a non-negative integer with provenance");
    });
    if (typeof step.stdout !== "string" || typeof step.stderr !== "string") err(p, "step.output", "stdout and stderr must be strings");
    if (!isRecord(step.observations) || !["partial", "unknown"].includes(String(step.observations.completeness)) || !Array.isArray(step.observations.notes)) err(`${p}.observations`, "observations.shape", "observations requires completeness and notes");
  });
  // Cross-reference checks are performed after collecting IDs from all snapshots.
  for (const [si, step] of input.steps.entries()) if (isRecord(step) && Array.isArray(step.frames)) {
    walkVariables(step.frames, (v, path) => {
      if (typeof v.storageId === "string" && !stepStorageIds[si]?.has(v.storageId)) err(`${path}.storageId`, "reference.storage-missing", "storageId does not identify storage in this snapshot");
      if (isEvidence(v.address) && v.id === v.address.value) err(`${path}.id`, "identity.address-alias", "variable identity must not be its runtime address");
      const r = v.value?.kind === "pointer" ? v.value.resolution : v.value?.kind === "reference" ? v.value.target : undefined;
      if (isRecord(r) && ["resolved", "out-of-bounds", "expired-by-observed-lifetime"].includes(String(r.status)) && typeof r.targetStorageId === "string" && !allStorageIds.has(r.targetStorageId)) err(`${path}.value`, "reference.target-missing", "resolution target does not identify a storage record in this trace");
      if (isRecord(r) && ["resolved", "out-of-bounds"].includes(String(r.status)) && typeof r.targetStorageId === "string" && !stepStorageIds[si]?.has(r.targetStorageId)) err(`${path}.value`, "reference.target-not-observed", "resolved target must be present in the same snapshot");
      if (v.value?.kind === "reference" && isRecord(r) && r.status === "null") err(`${path}.value`, "reference.null", "a C++ reference cannot have a null target");
      if (isRecord(r) && r.status === "expired-by-observed-lifetime") {
        const existsEnded = input.steps.some((s: unknown) => isRecord(s) && Array.isArray(s.storage) && s.storage.some((x: unknown) => isRecord(x) && x.id === r.targetStorageId && x.lifetime === "ended"));
        if (!existsEnded) err(`${path}.value`, "lifetime.unproven", "expired resolution requires an ended storage record with provenance evidence");
      }
      if (v.value?.kind === "pointer" && isRecord(v.value.resolution) && v.value.resolution.status === "null") {
        if (!isEvidence(v.value.addressValue)) err(`${path}.value.addressValue`, "pointer.null-unproven", "null resolution requires a known zero address value");
        else if (normalizeAddress(String(v.value.addressValue.value)) !== "0") err(`${path}.value.addressValue`, "pointer.null-contradiction", "null pointer cannot have a nonzero address value");
      }
    });
  }
  if (input.producer?.kind === "fixture") {
    walkTraceEvidence(input, (_value, provenance, path) => {
      if (provenance === "debugger-observed") warn(path, "provenance.fixture-observed", "fixture producer should not claim direct debugger observation");
    });
  }
  return issues;
}

export function assertValidExecutionTrace(input: unknown): asserts input is ExecutionTrace {
  const errors = validateExecutionTrace(input).filter(i => i.severity === "error");
  if (errors.length) throw new Error(`Invalid ExecutionTrace: ${errors.map(e => `${e.path} ${e.code}: ${e.message}`).join("; ")}`);
}

function validateVariable(v: unknown, p: string, err: (p: string, c: string, m: string) => void, ids: Set<string>): void {
  if (!isRecord(v) || typeof v.id !== "string" || !v.id) { err(p, "variable.shape", "variable requires a non-empty id"); return; }
  if (ids.has(v.id)) err(`${p}.id`, "identity.duplicate", "variable id must be unique within a step"); ids.add(v.id);
  if (!isTextEvidenceOrUnknown(v.name)) err(`${p}.name`, "variable.name", "name must carry evidence or an unknown/unavailable/error state");
  if (!isTextEvidenceOrUnknown(v.type)) err(`${p}.type`, "variable.type", "type must carry evidence or an unknown/unavailable/error state");
  if (!["local", "parameter", "global", "member", "element", "other"].includes(String(v.role))) err(`${p}.role`, "variable.role", "invalid variable role");
  if (v.address !== undefined && (!isEvidence(v.address) || !isHexAddress(v.address.value))) err(`${p}.address`, "variable.address", "address must be a hexadecimal runtime address with provenance");
  if (!isRecord(v.value) || !["scalar", "aggregate", "array", "pointer", "reference", "unavailable"].includes(String(v.value.kind))) { err(`${p}.value`, "value.kind", "unsupported or missing value kind"); return; }
  const val = v.value;
  if (val.provenance !== undefined && !isProvenance(val.provenance)) err(`${p}.value.provenance`, "provenance.invalid", "value provenance is invalid");
  if (val.kind !== "unavailable" && val.provenance === "unknown") err(`${p}.value.provenance`, "provenance.unknown-value", "unknown provenance cannot assert an available value");
  if (val.kind === "scalar" && (typeof val.display !== "string" || !isRecord(val.availability) || val.availability.status !== "available")) err(`${p}.value`, "value.scalar", "scalar requires display and available status");
  if (val.kind === "pointer" && (typeof val.display !== "string" || !isResolution(val.resolution) || !isAvailability(val.availability) || !(isEvidence(val.addressValue) || isUnknownField(val.addressValue)))) err(`${p}.value`, "value.pointer", "pointer requires display, address state, resolution, and availability");
  if (val.kind === "pointer" && isEvidence(val.addressValue) && !isHexAddress(val.addressValue.value)) err(`${p}.value.addressValue`, "pointer.address", "pointer address value must be hexadecimal with provenance");
  if (val.kind === "reference" && (typeof val.display !== "string" || !isResolution(val.target) || !isAvailability(val.availability))) err(`${p}.value`, "value.reference", "reference requires display, target resolution, and availability");
  if (val.kind === "unavailable" && (!isAvailability(val.availability) || val.availability.status === "available")) err(`${p}.value`, "value.unavailable", "unavailable value requires unknown, unavailable, or error availability");
  if (val.kind === "aggregate") {
    if (!Array.isArray(val.children)) err(`${p}.value.children`, "value.children", "aggregate children must be an array");
    else val.children.forEach((child: unknown, i: number) => validateVariable(child, `${p}.value.children[${i}]`, err, ids));
  }
  if (val.kind === "array") {
    if (!Array.isArray(val.elements) || !isExtent(val.extent)) err(`${p}.value`, "value.array", "array requires elements and an extent state");
    else val.elements.forEach((child: unknown, i: number) => validateVariable(child, `${p}.value.elements[${i}]`, err, ids));
  }
}
function isRecord(v: unknown): v is Record<string, any> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function isEvidence(v: unknown): v is Evidence<unknown> { return isRecord(v) && "value" in v && isProvenance(v.provenance) && v.provenance !== "unknown"; }
function isTextEvidenceOrUnknown(v: unknown): boolean { return (isEvidence(v) && typeof v.value === "string") || (isRecord(v) && ["unknown", "unavailable", "error"].includes(String(v.status)) && typeof v.reason === "string"); }
function isProvenance(v: unknown): v is Provenance { return ["debugger-observed", "backend-inferred", "instrumentation-tracked", "fixture-authored", "unknown"].includes(String(v)); }
function isAvailability(v: unknown): v is Availability { return isRecord(v) && ["available", "unknown", "unavailable", "error"].includes(String(v.status)); }
function isResolution(v: unknown): v is PointerResolution {
  if (!isRecord(v) || !isProvenance(v.provenance)) return false;
  if (v.status === "resolved") return typeof v.targetStorageId === "string" && !!v.targetStorageId && (v.offsetBytes === undefined || Number.isInteger(v.offsetBytes));
  if (v.status === "null") return true;
  if (v.status === "unresolved" || v.status === "unknown") return typeof v.reason === "string" && (v.status !== "unknown" || v.provenance === "unknown");
  if (v.status === "out-of-bounds") return typeof v.targetStorageId === "string" && Number.isInteger(v.offsetBytes);
  if (v.status === "expired-by-observed-lifetime") return typeof v.targetStorageId === "string";
  return false;
}
function isUnknownField(v: unknown): boolean { return isRecord(v) && ["unknown", "unavailable", "error"].includes(String(v.status)) && typeof v.reason === "string"; }
function sourceLineCount(text: string): number { const n = text.split("\n").length; return text.endsWith("\n") ? n - 1 : n; }
function isLocation(v: any): boolean { return isRecord(v) && ((v.status === "known" && isEvidence(v.line) && Number.isInteger(v.line.value)) || (["unknown", "unavailable"].includes(v.status) && typeof v.reason === "string")); }
function isExtent(v: any): boolean { return isEvidence(v) ? typeof v.value === "number" && Number.isInteger(v.value) && v.value >= 0 : isRecord(v) && ["unknown", "unavailable", "error"].includes(v.status) && typeof v.reason === "string"; }
function normalizeAddress(v: string): string { return v.toLowerCase().replace(/^0x/, "").replace(/^0+/, "") || "0"; }
function isHexAddress(v: unknown): boolean { return typeof v === "string" && /^0x[0-9a-f]+$/i.test(v); }
function walkVariables(frames: any[], visit: (v: any, path: string) => void): void {
  frames.forEach((f, fi) => f?.variables?.forEach((v: any, vi: number) => walkVar(v, `$.steps[*].frames[${fi}].variables[${vi}]`, visit)));
}
function walkVar(v: any, path: string, visit: (v: any, path: string) => void): void {
  if (!isRecord(v)) return; visit(v, path);
  const children = v.value?.kind === "aggregate" ? v.value.children : v.value?.kind === "array" ? v.value.elements : [];
  children.forEach((c: any, i: number) => walkVar(c, `${path}.value.children[${i}]`, visit));
}
function walkTraceEvidence(root: unknown, visit: (value: unknown, provenance: Provenance, path: string) => void): void {
  const go = (v: any, path: string): void => {
    if (!isRecord(v)) { if (Array.isArray(v)) v.forEach((x, i) => go(x, `${path}[${i}]`)); return; }
    if (isEvidence(v)) visit(v.value, v.provenance, path);
    if (isRecord(v.provenance) && isProvenance(v.provenance.value)) visit(undefined, v.provenance.value, `${path}.provenance`);
    for (const [k, x] of Object.entries(v)) go(x, `${path}.${k}`);
  }; go(root, "$");
}
