import { useRef } from "react";
import type { ExecutionStep } from "@visualized-gdb/execution-trace";
import { StackFrameSection } from "./StackFrameSection";
import { HeapSection } from "./HeapSection";
import { PointerOverlay } from "./PointerOverlay";
import { variables, nameOf } from "../../utils/memoryPresentation";
export function VisualMemoryCanvas({
  currentStep,
  activeDeltaTargetIds = new Set<string>(),
  slots,
  dense = false,
}: {
  currentStep: ExecutionStep;
  activeDeltaTargetIds?: Set<string>;
  slots: Map<string, string[]>;
  dense?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aliases = new Map<string, string[]>();
  const vars = variables(currentStep);
  for (const v of vars)
    if (v.value.kind === "reference" && v.value.target.status === "resolved") {
      const target = v.value.target.targetStorageId;
      if (
        vars.some((x) => x.storageId === target) ||
        currentStep.storage.some((s) => s.id === target && s.kind === "heap")
      )
        aliases.set(target, [...(aliases.get(target) ?? []), nameOf(v)]);
    }
  const hasHeap = currentStep.storage.some((s) => s.kind === "heap");
  return (
    <div
      className={`memory-stage ${hasHeap ? "with-heap" : ""} ${dense ? "dense-stage" : ""}`}
      ref={containerRef}
    >
      <div className="stack-region">
        <div className="region-heading">
          <h2>Stack</h2>
          <span>
            {currentStep.frames.length}{" "}
            {currentStep.frames.length === 1 ? "frame" : "frames"}
          </span>
        </div>
        <StackFrameSection
          frames={currentStep.frames}
          storageObjects={currentStep.storage}
          activeDeltaTargetIds={activeDeltaTargetIds}
          slots={slots}
          aliases={aliases}
        />
      </div>
      <HeapSection
        storageObjects={currentStep.storage}
        activeDeltaTargetIds={activeDeltaTargetIds}
        aliases={aliases}
      />
      <PointerOverlay step={currentStep} containerRef={containerRef} />
    </div>
  );
}
