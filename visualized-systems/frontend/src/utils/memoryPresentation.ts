import type {
  ExecutionStep,
  RuntimeValue,
  Variable,
} from "@visualized-gdb/execution-trace";
import { getEvidenceValue as evidence } from "./deltaDerivation";
export const nameOf = (v: Variable) =>
  evidence<string>(v.name) ?? "Unnamed variable";
export function variables(step: ExecutionStep): Variable[] {
  const all: Variable[] = [];
  const visit = (v: Variable) => {
    all.push(v);
    if (v.value.kind === "array") v.value.elements.forEach(visit);
    if (v.value.kind === "aggregate") v.value.children.forEach(visit);
  };
  step.frames.forEach((f) => f.variables.forEach(visit));
  return all;
}
export function valueText(value: RuntimeValue): string {
  switch (value.kind) {
    case "scalar":
      return value.display;
    case "pointer":
      return value.resolution.status === "null"
        ? "nullptr"
        : (evidence<string>(value.addressValue) ?? value.display ?? "Unknown");
    case "reference":
      return "Alias";
    case "unavailable":
      return value.availability.status === "unknown"
        ? "Unknown"
        : value.availability.status === "error"
          ? "Read error"
          : "Unavailable";
    case "array":
      return "Array";
    case "aggregate":
      return "Object";
  }
}
export function presentChanges(
  current: ExecutionStep,
  previous: ExecutionStep | null,
) {
  const changed = new Set<string>();
  const messages: string[] = [];
  const old = new Map(
    previous ? variables(previous).map((v) => [v.id, v]) : [],
  );
  const currentVars = variables(current);
  const targetName = (id: string) =>
    currentVars.find((v) => v.storageId === id)?.name;
  for (const v of currentVars) {
    const prev = old.get(v.id);
    if (prev && JSON.stringify(prev.value) === JSON.stringify(v.value))
      continue;
    if (previous) changed.add(v.id);
    const parent = currentVars.find(
      (p) =>
        p.value.kind === "array" && p.value.elements.some((e) => e.id === v.id),
    );
    const name = parent ? `${nameOf(parent)}${nameOf(v)}` : nameOf(v);
    const value = v.value;
    if (value.kind === "pointer") {
      const r = value.resolution;
      if (r.status === "resolved")
        messages.push(
          `${name} points to ${evidence<string>(targetName(r.targetStorageId)) ?? "the allocation"}.`,
        );
      else if (r.status === "null")
        messages.push(`${name} is nullptr. It points to nothing.`);
      else if (r.status === "expired-by-observed-lifetime")
        messages.push(
          `${name} still holds the address of storage whose lifetime ended.`,
        );
      else
        messages.push(
          `${name}: ${r.status === "unknown" ? "target unknown" : r.status}.`,
        );
    } else if (
      value.kind === "reference" &&
      value.target.status === "resolved"
    ) {
      messages.push(
        `${name} is another name for ${evidence<string>(targetName(value.target.targetStorageId)) ?? "its target"}.`,
      );
    } else if (value.kind === "scalar") {
      messages.push(
        prev?.value.kind === "scalar"
          ? `${name} changed from ${prev.value.display} to ${value.display}.`
          : `${name} holds ${value.display}.`,
      );
    } else if (value.kind === "unavailable")
      messages.push(`${name}: ${valueText(value).toLowerCase()}.`);
  }
  if (previous) {
    for (const s of current.storage)
      if (
        s.lifetime === "ended" &&
        previous.storage.find((p) => p.id === s.id)?.lifetime === "live"
      ) {
        changed.add(s.id);
        messages.unshift("The allocation’s lifetime ended.");
      }
    const added = current.frames.filter(
      (f) => !previous.frames.some((p) => p.id === f.id),
    );
    const removed = previous.frames.filter(
      (f) => !current.frames.some((p) => p.id === f.id),
    );
    if (added.length)
      messages.unshift(
        `${evidence<string>(added[0].functionName) ?? "A function"} now has its own frame.`,
      );
    if (removed.length)
      messages.unshift(
        `${evidence<string>(removed[0].functionName) ?? "The function"}’s frame is no longer in this snapshot.`,
      );
  }
  return {
    changed,
    messages: messages.length
      ? messages
      : ["Memory is unchanged at this stop."],
  };
}
