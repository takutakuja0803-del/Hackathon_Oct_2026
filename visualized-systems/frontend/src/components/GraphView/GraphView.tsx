import { useState, useRef, useMemo, type MouseEvent, type WheelEvent } from "react";
import type { CurveSnapshot, PlottedPoint } from "@visualized-gdb/equation-trace";

interface GraphViewProps {
  activeCurve: CurveSnapshot;
  referenceCurves?: CurveSnapshot[];
  title?: string;
}

export function GraphView({
  activeCurve,
  referenceCurves = [],
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport bounds in mathematical coordinates
  const [viewport, setViewport] = useState({
    xMin: -8,
    xMax: 8,
    yMin: -5,
    yMax: 8,
  });

  const [hoverCoord, setHoverCoord] = useState<PlottedPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // SVG dimensions
  const width = 640;
  const height = 440;
  const padding = 20;

  // Coordinate transforms
  const toScreenX = (x: number) => {
    return padding + ((x - viewport.xMin) / (viewport.xMax - viewport.xMin)) * (width - 2 * padding);
  };

  const toScreenY = (y: number) => {
    return height - padding - ((y - viewport.yMin) / (viewport.yMax - viewport.yMin)) * (height - 2 * padding);
  };

  const toMathX = (screenX: number) => {
    const ratio = (screenX - padding) / (width - 2 * padding);
    return viewport.xMin + ratio * (viewport.xMax - viewport.xMin);
  };

  const toMathY = (screenY: number) => {
    const ratio = (height - padding - screenY) / (height - 2 * padding);
    return viewport.yMin + ratio * (viewport.yMax - viewport.yMin);
  };

  // Generate grid lines
  const grid = useMemo(() => {
    const xStep = Math.max(1, Math.round((viewport.xMax - viewport.xMin) / 10));
    const yStep = Math.max(1, Math.round((viewport.yMax - viewport.yMin) / 8));

    const vLines: { x: number; isAxis: boolean; label?: string }[] = [];
    const hLines: { y: number; isAxis: boolean; label?: string }[] = [];

    const firstX = Math.ceil(viewport.xMin / xStep) * xStep;
    for (let x = firstX; x <= viewport.xMax; x += xStep) {
      vLines.push({
        x,
        isAxis: Math.abs(x) < 0.001,
        label: Math.abs(x) >= 0.001 ? String(x) : undefined,
      });
    }

    const firstY = Math.ceil(viewport.yMin / yStep) * yStep;
    for (let y = firstY; y <= viewport.yMax; y += yStep) {
      hLines.push({
        y,
        isAxis: Math.abs(y) < 0.001,
        label: Math.abs(y) >= 0.001 ? String(y) : undefined,
      });
    }

    return { vLines, hLines, xStep, yStep };
  }, [viewport]);

  // Convert points to SVG path data (clamping / splitting over discontinuities)
  const buildSvgPath = (points?: PlottedPoint[]) => {
    if (!points || points.length === 0) return "";

    let d = "";
    let inSegment = false;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      // Skip out-of-range extreme values
      if (
        !Number.isFinite(pt.x) ||
        !Number.isFinite(pt.y) ||
        pt.y < viewport.yMin - 15 ||
        pt.y > viewport.yMax + 15
      ) {
        inSegment = false;
        continue;
      }

      const sx = toScreenX(pt.x);
      const sy = toScreenY(pt.y);

      if (!inSegment) {
        d += `M ${sx.toFixed(1)} ${sy.toFixed(1)} `;
        inSegment = true;
      } else {
        d += `L ${sx.toFixed(1)} ${sy.toFixed(1)} `;
      }
    }

    return d;
  };

  // Zoom controls
  const handleZoom = (factor: number) => {
    setViewport((v) => {
      const cx = (v.xMin + v.xMax) / 2;
      const cy = (v.yMin + v.yMax) / 2;
      const dx = (v.xMax - v.xMin) * factor * 0.5;
      const dy = (v.yMax - v.yMin) * factor * 0.5;
      return {
        xMin: cx - dx,
        xMax: cx + dx,
        yMin: cy - dy,
        yMax: cy + dy,
      };
    });
  };

  const handleResetZoom = () => {
    setViewport({ xMin: -8, xMax: 8, yMin: -5, yMax: 8 });
  };

  // Pan by drag
  const handleMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mathX = Number(toMathX(mouseX).toFixed(2));
    const mathY = Number(toMathY(mouseY).toFixed(2));
    setHoverCoord({ x: mathX, y: mathY });

    if (isDragging && dragStart) {
      const dxPixels = e.clientX - dragStart.x;
      const dyPixels = e.clientY - dragStart.y;

      const dxMath = (dxPixels / (width - 2 * padding)) * (viewport.xMax - viewport.xMin);
      const dyMath = (dyPixels / (height - 2 * padding)) * (viewport.yMax - viewport.yMin);

      setViewport((v) => ({
        xMin: v.xMin - dxMath,
        xMax: v.xMax - dxMath,
        yMin: v.yMin + dyMath,
        yMax: v.yMax + dyMath,
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    handleZoom(factor);
  };

  const axisOriginX = toScreenX(0);
  const axisOriginY = toScreenY(0);

  return (
    <div className="graph-container" ref={containerRef}>
      <div className="graph-toolbar">
        <div className="graph-legend">
          {referenceCurves.map((curve, idx) => (
            <span key={idx} className="legend-item reference">
              <span className="legend-line reference" />
              <span>{curve.name}(x) = {curve.expression}</span>
            </span>
          ))}
          <span className="legend-item active">
            <span className="legend-line active" />
            <strong>{activeCurve.name}(x) = {activeCurve.expression}</strong>
          </span>
        </div>
        <div className="graph-controls">
          {hoverCoord && (
            <span className="coordinate-pill">
              x: {hoverCoord.x}, y: {hoverCoord.y}
            </span>
          )}
          <button
            type="button"
            className="graph-btn"
            title="Zoom In"
            onClick={() => handleZoom(0.8)}
          >
            +
          </button>
          <button
            type="button"
            className="graph-btn"
            title="Zoom Out"
            onClick={() => handleZoom(1.25)}
          >
            −
          </button>
          <button
            type="button"
            className="graph-btn"
            title="Reset View"
            onClick={handleResetZoom}
          >
            ⟲
          </button>
        </div>
      </div>

      <div className="graph-canvas-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`graph-svg ${isDragging ? "dragging" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoverCoord(null);
          }}
          onWheel={handleWheel}
        >
          {/* Subtle clip path */}
          <defs>
            <clipPath id="graph-viewport-clip">
              <rect
                x={padding}
                y={padding}
                width={width - 2 * padding}
                height={height - 2 * padding}
              />
            </clipPath>
          </defs>

          {/* Background grid lines */}
          <g className="grid-layer" clipPath="url(#graph-viewport-clip)">
            {grid.vLines.map((line, i) => {
              const sx = toScreenX(line.x);
              return (
                <line
                  key={`v-${i}`}
                  x1={sx}
                  y1={padding}
                  x2={sx}
                  y2={height - padding}
                  stroke={line.isAxis ? "transparent" : "rgba(20, 24, 30, 0.08)"}
                  strokeWidth="1"
                />
              );
            })}
            {grid.hLines.map((line, i) => {
              const sy = toScreenY(line.y);
              return (
                <line
                  key={`h-${i}`}
                  x1={padding}
                  y1={sy}
                  x2={width - padding}
                  y2={sy}
                  stroke={line.isAxis ? "transparent" : "rgba(20, 24, 30, 0.08)"}
                  strokeWidth="1"
                />
              );
            })}
          </g>

          {/* Coordinate axes */}
          <g className="axes-layer" clipPath="url(#graph-viewport-clip)">
            {/* X-axis */}
            {axisOriginY >= padding && axisOriginY <= height - padding && (
              <line
                x1={padding}
                y1={axisOriginY}
                x2={width - padding}
                y2={axisOriginY}
                stroke="rgba(23, 24, 26, 0.45)"
                strokeWidth="1.5"
              />
            )}
            {/* Y-axis */}
            {axisOriginX >= padding && axisOriginX <= width - padding && (
              <line
                x1={axisOriginX}
                y1={padding}
                x2={axisOriginX}
                y2={height - padding}
                stroke="rgba(23, 24, 26, 0.45)"
                strokeWidth="1.5"
              />
            )}
          </g>

          {/* Axis Tick Numbers */}
          <g className="tick-labels" clipPath="url(#graph-viewport-clip)">
            {grid.vLines.map((line, i) => {
              if (!line.label) return null;
              const sx = toScreenX(line.x);
              const sy = Math.max(padding + 14, Math.min(height - padding - 6, axisOriginY + 14));
              return (
                <text
                  key={`tx-${i}`}
                  x={sx}
                  y={sy}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#62666d"
                  fontFamily="Menlo, monospace"
                >
                  {line.label}
                </text>
              );
            })}
            {grid.hLines.map((line, i) => {
              if (!line.label) return null;
              const sy = toScreenY(line.y);
              const sx = Math.max(padding + 6, Math.min(width - padding - 18, axisOriginX - 8));
              return (
                <text
                  key={`ty-${i}`}
                  x={sx}
                  y={sy + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#62666d"
                  fontFamily="Menlo, monospace"
                >
                  {line.label}
                </text>
              );
            })}
          </g>

          {/* Plotted Curves */}
          <g className="curves-layer" clipPath="url(#graph-viewport-clip)">
            {/* Reference curves (prior steps) */}
            {referenceCurves.map((curve, idx) => {
              const d = buildSvgPath(curve.points);
              if (!d) return null;
              return (
                <path
                  key={`ref-${idx}`}
                  d={d}
                  fill="none"
                  stroke="rgba(98, 102, 109, 0.45)"
                  strokeWidth="1.75"
                  strokeDasharray="5,4"
                />
              );
            })}

            {/* Active curve (current step) */}
            {activeCurve.points && (
              <path
                d={buildSvgPath(activeCurve.points)}
                fill="none"
                stroke="#0066cc"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>

          {/* Hover Crosshair Guide */}
          {hoverCoord && (
            <g className="crosshair-layer" clipPath="url(#graph-viewport-clip)">
              <line
                x1={toScreenX(hoverCoord.x)}
                y1={padding}
                x2={toScreenX(hoverCoord.x)}
                y2={height - padding}
                stroke="rgba(0, 102, 204, 0.2)"
                strokeDasharray="2,2"
              />
              <line
                x1={padding}
                y1={toScreenY(hoverCoord.y)}
                x2={width - padding}
                y2={toScreenY(hoverCoord.y)}
                stroke="rgba(0, 102, 204, 0.2)"
                strokeDasharray="2,2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
