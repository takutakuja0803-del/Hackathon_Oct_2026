import { GOLDEN_FIXTURES, type FixtureDescriptor } from "../../fixtures";
import type { EquationFixture } from "../../fixtures/equationFixtures";

export type ProductMode = "gdb" | "equations";

export function Header({
  currentMode,
  onSelectMode,
  currentFixtureId,
  onSelectFixture,
  isLiveMode,
  onToggleLiveMode,
  onVisualize,
  isVisualizing,
  equationFixtures = [],
  currentEquationId,
  onSelectEquationFixture,
}: {
  currentMode: ProductMode;
  onSelectMode: (mode: ProductMode) => void;
  // GDB mode props
  currentFixtureId: string;
  onSelectFixture: (f: FixtureDescriptor) => void;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
  onVisualize: () => void;
  isVisualizing: boolean;
  // Equations mode props
  equationFixtures?: EquationFixture[];
  currentEquationId?: string;
  onSelectEquationFixture?: (f: EquationFixture) => void;
}) {
  return (
    <header className="site-header">
      <div className="brand-group">
        <span className="brand">Visualized Systems</span>
        <div className="mode-switcher" role="tablist" aria-label="Visualized Systems Modes">
          <button
            type="button"
            role="tab"
            aria-selected={currentMode === "gdb"}
            className={`mode-tab ${currentMode === "gdb" ? "active" : ""}`}
            onClick={() => onSelectMode("gdb")}
          >
            Visualized GDB
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentMode === "equations"}
            className={`mode-tab ${currentMode === "equations" ? "active" : ""}`}
            onClick={() => onSelectMode("equations")}
          >
            Visualized Equations
          </button>
        </div>
      </div>

      <div className="header-actions">
        {currentMode === "gdb" ? (
          !isLiveMode ? (
            <>
              <label className="example-picker">
                <span>Example</span>
                <select
                  aria-label="Example"
                  value={currentFixtureId}
                  onChange={(e) => {
                    const f = GOLDEN_FIXTURES.find((f) => f.id === e.target.value);
                    if (f) onSelectFixture(f);
                  }}
                >
                  {GOLDEN_FIXTURES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.key} · {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="live-mode-btn"
                onClick={onToggleLiveMode}
              >
                Edit / Live Code
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="live-mode-btn active"
                onClick={onToggleLiveMode}
              >
                ‹ Examples
              </button>
              <button
                type="button"
                className="visualize-btn"
                onClick={onVisualize}
                disabled={isVisualizing}
              >
                {isVisualizing ? "Visualizing…" : "Visualize"}
              </button>
            </>
          )
        ) : (
          /* Equations Mode Controls */
          <>
            <label className="example-picker">
              <span>Example</span>
              <select
                aria-label="Equation Example"
                value={currentEquationId}
                onChange={(e) => {
                  const f = equationFixtures.find((eq) => eq.id === e.target.value);
                  if (f && onSelectEquationFixture) onSelectEquationFixture(f);
                }}
              >
                {equationFixtures.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.key} · {f.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
    </header>
  );
}
