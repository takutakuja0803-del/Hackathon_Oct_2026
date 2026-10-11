import React, { useLayoutEffect, useState, useRef } from "react";
import { ExecutionStep, Variable } from "@visualized-gdb/execution-trace";

interface PointerOverlayProps {
  step: ExecutionStep;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface ExtractedEdge {
  id: string;
  sourceVarId: string;
  targetStorageId: string;
  type: "pointer" | "reference";
  status: "resolved" | "out-of-bounds" | "expired-by-observed-lifetime";
  label?: string;
}

interface CalculatedCurve {
  edgeId: string;
  path: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  label?: string;
  color: string;
  isDashed: boolean;
  isDangling: boolean;
}

function extractEdgesFromStep(step: ExecutionStep): ExtractedEdge[] {
  const edges: ExtractedEdge[] = [];

  const inspectVar = (v: Variable) => {
    if (v.value.kind === "pointer") {
      const res = v.value.resolution;
      if (res.status === "resolved" || res.status === "out-of-bounds") {
        edges.push({
          id: `edge-${v.id}-${res.targetStorageId}`,
          sourceVarId: v.id,
          targetStorageId: res.targetStorageId,
          type: "pointer",
          status: res.status,
          label: res.offsetBytes ? `+${res.offsetBytes}B` : undefined,
        });
      } else if (res.status === "expired-by-observed-lifetime") {
        edges.push({
          id: `edge-${v.id}-${res.targetStorageId}`,
          sourceVarId: v.id,
          targetStorageId: res.targetStorageId,
          type: "pointer",
          status: "expired-by-observed-lifetime",
          label: "DANGLING",
        });
      }
    } else if (v.value.kind === "array") {
      v.value.elements.forEach(inspectVar);
    } else if (v.value.kind === "aggregate") {
      v.value.children.forEach(inspectVar);
    }
  };

  step.frames.forEach((f) => {
    f.variables.forEach(inspectVar);
  });

  return edges;
}

export const PointerOverlay: React.FC<PointerOverlayProps> = ({
  step,
  containerRef,
}) => {
  const [curves, setCurves] = useState<CalculatedCurve[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const calculatePositions = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    const edges = extractEdgesFromStep(step);
    const newCurves: CalculatedCurve[] = [];

    edges.forEach((edge) => {
      // Find source element (the pointer variable box)
      const sourceEl = container.querySelector(
        `[data-var-id="${CSS.escape(edge.sourceVarId)}"]`,
      ) as HTMLElement | null;

      // Find target element (the target storage box)
      const targetEl = container.querySelector(
        `[data-storage-id="${CSS.escape(edge.targetStorageId)}"]`,
      ) as HTMLElement | null;

      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = (
          targetEl.querySelector(".cell-value") ?? targetEl
        ).getBoundingClientRect();

        const sCenterY =
          sRect.top + sRect.height / 2 - containerRect.top + scrollTop;
        const tCenterY =
          tRect.top + tRect.height / 2 - containerRect.top + scrollTop;

        const isTargetToRight = tRect.left > sRect.right - 10;
        const isTargetToLeft = sRect.left > tRect.right - 10;
        const isTargetBelow = tRect.top > sRect.bottom - 10;

        let sourceX: number;
        let sourceY: number;
        let targetX: number;
        let targetY: number;

        let cx1: number;
        let cy1: number;
        let cx2: number;
        let cy2: number;

        if (isTargetToRight) {
          // Connect right edge of source to left edge of target
          sourceX = sRect.right - containerRect.left + scrollLeft;
          sourceY = sCenterY;
          targetX = tRect.left - containerRect.left + scrollLeft;
          targetY = tCenterY;

          const dx = targetX - sourceX;
          cx1 = sourceX + Math.max(30, dx * 0.45);
          cy1 = sourceY;
          cx2 = targetX - Math.max(30, dx * 0.45);
          cy2 = targetY;
        } else if (isTargetToLeft) {
          // Connect left edge of source to right edge of target
          sourceX = sRect.left - containerRect.left + scrollLeft;
          sourceY = sCenterY;
          targetX = tRect.right - containerRect.left + scrollLeft;
          targetY = tCenterY;

          const dx = Math.abs(targetX - sourceX);
          cx1 = sourceX - Math.max(30, dx * 0.45);
          cy1 = sourceY;
          cx2 = targetX + Math.max(30, dx * 0.45);
          cy2 = targetY;
        } else if (isTargetBelow) {
          // Route down the inter-cell lane so the pointer does not cross addresses.
          sourceX = sRect.right - containerRect.left + scrollLeft;
          sourceY = sCenterY;
          targetX = tRect.right - containerRect.left + scrollLeft;
          targetY = tCenterY;
          cx1 = Math.max(sourceX, targetX) + 24;
          cy1 = sourceY;
          cx2 = Math.max(sourceX, targetX) + 24;
          cy2 = targetY;
        } else {
          // Arc curve around adjacent elements
          sourceX = sRect.right - containerRect.left + scrollLeft;
          sourceY = sCenterY;
          targetX = tRect.right - containerRect.left + scrollLeft;
          targetY = tCenterY;

          const dy = targetY - sourceY;
          const arch = Math.max(50, Math.abs(dy) * 0.35);
          cx1 = Math.max(sourceX, targetX) + arch;
          cy1 = sourceY + dy * 0.2;
          cx2 = Math.max(sourceX, targetX) + arch;
          cy2 = targetY - dy * 0.2;
        }

        const path = `M ${sourceX} ${sourceY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetX} ${targetY}`;

        const isDangling = edge.status === "expired-by-observed-lifetime";
        const color = isDangling ? "#e11d48" : "#0066cc";

        newCurves.push({
          edgeId: edge.id,
          path,
          sourceX,
          sourceY,
          targetX,
          targetY,
          label: isDangling ? undefined : edge.label,
          color,
          isDashed: isDangling,
          isDangling,
        });
      }
    });

    setCurves(newCurves);
  };

  useLayoutEffect(() => {
    const handleRecalculate = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(calculatePositions);
    };

    handleRecalculate();

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleRecalculate, {
        passive: true,
      });
    }
    window.addEventListener("resize", handleRecalculate, { passive: true });

    const observer = new ResizeObserver(handleRecalculate);
    if (container) {
      observer.observe(container);
      container
        .querySelectorAll("[data-storage-id], [data-var-id]")
        .forEach((el) => observer.observe(el));
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (container) {
        container.removeEventListener("scroll", handleRecalculate);
      }
      window.removeEventListener("resize", handleRecalculate);
      observer.disconnect();
    };
  }, [step, containerRef]);

  if (curves.length === 0) return null;

  return (
    <svg
      aria-label="Pointer relationships"
      className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
    >
      <defs>
        {/* Apple Royal Blue Arrowhead */}
        <marker
          id="apple-arrow-blue"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#0066cc" />
        </marker>

        {/* Rose Red Arrowhead for Dangling */}
        <marker
          id="apple-arrow-red"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#e11d48" />
        </marker>
      </defs>

      {curves.map((curve) => (
        <g key={curve.edgeId} className="transition-opacity duration-300">
          {/* White halo behind path to make arrow pop against cards and background */}
          <path
            d={curve.path}
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Source node indicator dot */}
          <circle
            cx={curve.sourceX}
            cy={curve.sourceY}
            r="4"
            fill={curve.color}
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {/* Main Pointer Arrow Path */}
          <path
            d={curve.path}
            fill="none"
            stroke={curve.color}
            strokeWidth="2.5"
            strokeDasharray={curve.isDashed ? "6,4" : undefined}
            markerEnd={
              curve.isDangling
                ? "url(#apple-arrow-red)"
                : "url(#apple-arrow-blue)"
            }
          />

          {/* Optional Label Tag */}
          {curve.label && (
            <g
              transform={`translate(${
                (curve.sourceX + curve.targetX) / 2 + 10
              }, ${(curve.sourceY + curve.targetY) / 2 - 8})`}
            >
              <rect
                x="-4"
                y="-10"
                width="66"
                height="18"
                rx="5"
                fill={curve.isDangling ? "#ffe4e6" : "#e0f2fe"}
                stroke={curve.isDangling ? "#f43f5e" : "#0284c7"}
                strokeWidth="1.5"
              />
              <text
                x="29"
                y="3"
                textAnchor="middle"
                fill={curve.isDangling ? "#be123c" : "#0369a1"}
                fontSize="10"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="800"
                letterSpacing="0.05em"
              >
                {curve.label}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
};
