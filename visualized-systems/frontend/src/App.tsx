import { useState, useEffect, useMemo } from "react";
import { GOLDEN_FIXTURES, type FixtureDescriptor } from "./fixtures";
import { EQUATION_FIXTURES, type EquationFixture } from "./fixtures/equationFixtures";
import type { ExecutionTrace } from "@visualized-gdb/execution-trace";
import { traceEquations, type EquationTrace } from "@visualized-gdb/equation-trace";
import { summarizeValidation } from "./utils/traceValidator";
import { presentChanges } from "./utils/memoryPresentation";
import { requestLiveTrace } from "./services/liveTracer";
import {
  checkUrlCodeParam,
  registerPostMessageListener,
  type ExternalCodePayload,
} from "./utils/extensionBridge";
import { Header, type ProductMode } from "./components/Header/Header";
import { CodeEditor } from "./components/CodeEditor/CodeEditor";
import { VisualMemoryCanvas } from "./components/MemoryView/VisualMemoryCanvas";
import { TerminalConsole } from "./components/Terminal/TerminalConsole";
import { StepperBar } from "./components/Controls/StepperBar";
import { GraphView } from "./components/GraphView/GraphView";
import { EquationEditor } from "./components/EquationEditor/EquationEditor";
import { EquationStepper } from "./components/EquationStepper/EquationStepper";

const DEFAULT_LIVE_CODE = `int main() {
    int x = 5;
    int* p = &x;
    *p = 10;
    return 0;
}`;

export function App() {
  // Top-level mode: "gdb" | "equations"
  const [productMode, setProductMode] = useState<ProductMode>("gdb");

  // ==========================================
  // Visualized GDB State (Preserved across mode switch)
  // ==========================================
  const [fixture, setFixture] = useState<FixtureDescriptor>(GOLDEN_FIXTURES[1]);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveCode, setLiveCode] = useState(DEFAULT_LIVE_CODE);
  const [liveTrace, setLiveTrace] = useState<ExecutionTrace | null>(null);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const trace = isLiveMode && liveTrace ? liveTrace : fixture.trace;
  const [gdbIndex, setGdbIndex] = useState(0);
  const [gdbPlaying, setGdbPlaying] = useState(false);
  const [gdbSpeed, setGdbSpeed] = useState(1000);
  const [imported, setImported] = useState<ExternalCodePayload | null>(null);
  const step = trace.steps[gdbIndex];
  const validation = useMemo(() => summarizeValidation(trace), [trace]);
  const presentation = useMemo(
    () => presentChanges(step, gdbIndex ? trace.steps[gdbIndex - 1] : null),
    [step, gdbIndex, trace],
  );

  // Reserve presentation slots by trace-local identity
  const slots = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const s of trace.steps)
      for (const f of s.frames) {
        const ids = result.get(f.id) ?? [];
        for (const v of f.variables)
          if (v.value.kind !== "reference" && !ids.includes(v.id))
            ids.push(v.id);
        result.set(f.id, ids);
      }
    return result;
  }, [trace]);

  useEffect(() => {
    if (!gdbPlaying || productMode !== "gdb") return;
    const t = setInterval(
      () =>
        setGdbIndex((i) => {
          if (i >= trace.steps.length - 1) {
            setGdbPlaying(false);
            return i;
          }
          return i + 1;
        }),
      gdbSpeed,
    );
    return () => clearInterval(t);
  }, [gdbPlaying, gdbSpeed, trace, productMode]);

  useEffect(() => {
    setImported(checkUrlCodeParam());
    return registerPostMessageListener(setImported);
  }, []);

  const selectFixture = (f: FixtureDescriptor) => {
    setIsLiveMode(false);
    setDiagnosticError(null);
    setFixture(f);
    setGdbIndex(0);
    setGdbPlaying(false);
  };

  const handleToggleLiveMode = () => {
    if (!isLiveMode) {
      setIsLiveMode(true);
      setDiagnosticError(null);
      setGdbIndex(0);
      setGdbPlaying(false);
      if (!liveTrace) {
        handleVisualize(liveCode);
      }
    } else {
      setIsLiveMode(false);
      setDiagnosticError(null);
      setGdbIndex(0);
      setGdbPlaying(false);
    }
  };

  const handleVisualize = async (codeToRun = liveCode) => {
    setIsVisualizing(true);
    setDiagnosticError(null);
    try {
      const res = await requestLiveTrace(codeToRun);
      if (res.success && res.trace) {
        setLiveTrace(res.trace);
        setGdbIndex(0);
        setGdbPlaying(false);
      } else {
        const msg =
          res.error ||
          res.diagnostics?.[0]?.message ||
          "Compilation or execution failed.";
        setDiagnosticError(msg);
      }
    } catch (err: any) {
      setDiagnosticError(err.message || "Failed to visualize code.");
    } finally {
      setIsVisualizing(false);
    }
  };

  const gdbLine = step.location.status === "known" ? step.location.line.value : 0;

  // ==========================================
  // Visualized Equations State (Preserved across mode switch)
  // ==========================================
  const [eqFixture, setEqFixture] = useState<EquationFixture>(EQUATION_FIXTURES[0]);
  const [eqCode, setEqCode] = useState(EQUATION_FIXTURES[0].code);
  const [eqTrace, setEqTrace] = useState<EquationTrace>(() => traceEquations(EQUATION_FIXTURES[0].code));
  const [eqIndex, setEqIndex] = useState(0);
  const [eqPlaying, setEqPlaying] = useState(false);

  // Re-trace on equation code change or fixture change
  const selectEquationFixture = (f: EquationFixture) => {
    setEqFixture(f);
    setEqCode(f.code);
    const newTrace = traceEquations(f.code);
    setEqTrace(newTrace);
    setEqIndex(0);
    setEqPlaying(false);
  };

  const handleUpdateEquationTrace = (codeToTrace = eqCode) => {
    const newTrace = traceEquations(codeToTrace);
    setEqTrace(newTrace);
    setEqIndex(0);
    setEqPlaying(false);
  };

  // Playback timer for Equations
  useEffect(() => {
    if (!eqPlaying || productMode !== "equations") return;
    const t = setInterval(() => {
      setEqIndex((i) => {
        if (i >= eqTrace.steps.length - 1) {
          setEqPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1500);
    return () => clearInterval(t);
  }, [eqPlaying, eqTrace, productMode]);

  const currentEquationStep = eqTrace.steps[eqIndex];

  return (
    <div className="app-shell">
      <Header
        currentMode={productMode}
        onSelectMode={setProductMode}
        currentFixtureId={fixture.id}
        onSelectFixture={selectFixture}
        isLiveMode={isLiveMode}
        onToggleLiveMode={handleToggleLiveMode}
        onVisualize={() => handleVisualize()}
        isVisualizing={isVisualizing}
        equationFixtures={EQUATION_FIXTURES}
        currentEquationId={eqFixture.id}
        onSelectEquationFixture={selectEquationFixture}
      />

      {productMode === "gdb" ? (
        /* ==========================================
           VISUALIZED GDB MODE
           ========================================== */
        <main className="lesson">
          <div className="lesson-intro">
            <p className="eyebrow">C++ · A visual memory textbook</p>
            <h1>See what your code changes.</h1>
            <p>Follow a value. Trace a pointer. One step at a time.</p>
          </div>
          {imported && (
            <div className="import-notice">
              {imported.mode === "equations" ? "Equation" : "Code"} received from {imported.source}.
              <button
                onClick={() => {
                  if (imported.mode === "equations") {
                    setProductMode("equations");
                    setEqCode(imported.code);
                    handleUpdateEquationTrace(imported.code);
                  } else {
                    setLiveCode(imported.code);
                    setIsLiveMode(true);
                    handleVisualize(imported.code);
                  }
                  setImported(null);
                }}
              >
                Visualize this {imported.mode === "equations" ? "equation" : "code"}
              </button>
              <button onClick={() => setImported(null)}>Dismiss</button>
            </div>
          )}
          {diagnosticError && (
            <div className="diagnostic-notice" role="alert">
              <span>
                <strong>Diagnostic:</strong> {diagnosticError}
              </span>
              <button onClick={() => setDiagnosticError(null)}>Dismiss</button>
            </div>
          )}
          <section className="workspace" aria-label="Interactive memory lesson">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">
                  {isLiveMode ? "Live Execution" : `Example ${fixture.key}`}
                </span>
                <h2>{isLiveMode ? "User Program" : fixture.name}</h2>
              </div>
              <span className="fixture-label">
                {isLiveMode ? "Compiled native execution" : "Illustrated execution"}
              </span>
            </div>
            <div className="lesson-columns">
              <aside className="code-column">
                <div className="column-heading">
                  <h2>Code</h2>
                  <span>{isLiveMode ? "Editable C++" : "C++20"}</span>
                </div>
                <CodeEditor
                  sourceCode={isLiveMode ? liveCode : trace.source.text}
                  activeLine={gdbLine}
                  fileName={
                    isLiveMode
                      ? "main.cpp"
                      : `${fixture.key.toLowerCase()}_example.cpp`
                  }
                  readOnly={!isLiveMode}
                  onCodeChange={isLiveMode ? setLiveCode : undefined}
                />
                <p className="code-note">
                  {isLiveMode
                    ? "Edit C++ and click Visualize to compile and trace."
                    : "The highlighted line marks this snapshot’s source location."}
                </p>
              </aside>
              <section
                className="memory-column"
                aria-label="Memory visualization"
              >
                <div className="column-heading">
                  <h2>Memory, right now</h2>
                  <span>Step {gdbIndex + 1}</span>
                </div>
                <VisualMemoryCanvas
                  currentStep={step}
                  activeDeltaTargetIds={presentation.changed}
                  slots={slots}
                  dense={trace.steps.some(
                    (s) =>
                      s.frames.reduce((n, f) => n + f.variables.length, 0) > 4,
                  )}
                />
              </section>
            </div>
            <div className="change-story" aria-live="polite">
              <span className="story-mark" aria-hidden="true">
                ↳
              </span>
              <div>
                {presentation.messages.slice(0, 3).map((m, i) => (
                  <p key={i}>{m}</p>
                ))}
              </div>
            </div>
            <StepperBar
              currentStepIndex={gdbIndex}
              totalSteps={trace.steps.length}
              isPlaying={gdbPlaying}
              playbackSpeed={gdbSpeed}
              onStepChange={(n) => {
                setGdbPlaying(false);
                setGdbIndex(Math.max(0, Math.min(n, trace.steps.length - 1)));
              }}
              onTogglePlay={() => {
                if (gdbIndex === trace.steps.length - 1) setGdbIndex(0);
                setGdbPlaying((p) => !p);
              }}
              onSpeedChange={setGdbSpeed}
              onReset={() => {
                setGdbIndex(0);
                setGdbPlaying(false);
              }}
            />
            <div className="lesson-extras">
              <TerminalConsole
                cumulativeStdout={trace.steps
                  .slice(0, gdbIndex + 1)
                  .map((s) => s.stdout)
                  .join("")}
                stderr={trace.steps
                  .slice(0, gdbIndex + 1)
                  .map((s) => s.stderr)
                  .join("")}
              />
              <details className="trace-details">
                <summary>Details</summary>
                <div>
                  <p>
                    ExecutionTrace {trace.schemaVersion} ·{" "}
                    {validation.isValid
                      ? "Validation passed"
                      : "Validation errors"}
                  </p>
                  <p>
                    Producer: {trace.producer.name} ({trace.producer.kind}).
                  </p>
                  <p>
                    Stop: {step.stop.reason} · {step.stop.description}
                  </p>
                  <p>
                    Observations: {step.observations.completeness}.{" "}
                    {step.observations.notes?.join(" ")}
                  </p>
                  <pre>
                    {JSON.stringify(
                      { diagnostics: trace.diagnostics, snapshot: step },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>
            </div>
          </section>
          <footer className="page-footer">
            <span>Visualized GDB · Original design: Takumi Naito</span>
            <span>Values first. Details when you need them.</span>
          </footer>
        </main>
      ) : (
        /* ==========================================
           VISUALIZED EQUATIONS MODE
           ========================================== */
        <main className="lesson">
          <div className="lesson-intro">
            <p className="eyebrow">Mathematics · A visual transformation textbook</p>
            <h1>See what each equation transforms.</h1>
            <p>Trace functions step by step. See shifts, reflections, and scalings in real time.</p>
          </div>
          {imported && (
            <div className="import-notice">
              {imported.mode === "equations" ? "Equation" : "Code"} received from {imported.source}.
              <button
                onClick={() => {
                  if (imported.mode === "equations") {
                    setEqCode(imported.code);
                    handleUpdateEquationTrace(imported.code);
                  } else {
                    setProductMode("gdb");
                    setLiveCode(imported.code);
                    setIsLiveMode(true);
                    handleVisualize(imported.code);
                  }
                  setImported(null);
                }}
              >
                Visualize this {imported.mode === "equations" ? "equation" : "code"}
              </button>
              <button onClick={() => setImported(null)}>Dismiss</button>
            </div>
          )}

          {eqTrace.diagnostics.length > 0 && (
            <div className="diagnostic-notice" role="alert">
              <span>
                <strong>Syntax Diagnostic:</strong> Line {eqTrace.diagnostics[0].line}: {eqTrace.diagnostics[0].message}
              </span>
            </div>
          )}

          <section className="workspace" aria-label="Interactive mathematical equation lesson">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">
                  Example {eqFixture.key} · {eqFixture.category.toUpperCase()}
                </span>
                <h2>{eqFixture.name}</h2>
              </div>
              <span className="fixture-label">
                EquationTrace v0.1 · Pure mathematical truth
              </span>
            </div>

            <div className="lesson-columns">
              <aside className="code-column">
                <div className="column-heading">
                  <h2>Equations</h2>
                  <span>Step {eqIndex + 1} of {Math.max(1, eqTrace.steps.length)}</span>
                </div>
                <EquationEditor
                  code={eqCode}
                  onChange={(c) => {
                    setEqCode(c);
                    handleUpdateEquationTrace(c);
                  }}
                  activeLine={currentEquationStep?.sourceLine}
                  onTrace={() => handleUpdateEquationTrace(eqCode)}
                />
                <p className="code-note">
                  Edit equations and see the graph and mathematical transformation explanations update automatically.
                </p>
              </aside>

              <section className="memory-column" aria-label="Coordinate graph view">
                <div className="column-heading">
                  <h2>Cartesian Plane, right now</h2>
                  <span>x ∈ [-8, 8], y ∈ [-5, 8]</span>
                </div>
                {currentEquationStep ? (
                  <GraphView
                    activeCurve={currentEquationStep.activeCurve}
                    referenceCurves={currentEquationStep.referenceCurves}
                  />
                ) : (
                  <div className="empty-graph-notice">
                    No valid function step to display.
                  </div>
                )}
              </section>
            </div>

            <EquationStepper
              currentStepIndex={eqIndex}
              totalSteps={eqTrace.steps.length}
              currentStep={currentEquationStep}
              isPlaying={eqPlaying}
              onStepChange={(idx) => {
                setEqPlaying(false);
                setEqIndex(idx);
              }}
              onTogglePlay={() => {
                if (eqIndex >= eqTrace.steps.length - 1) setEqIndex(0);
                setEqPlaying((p) => !p);
              }}
              onReset={() => {
                setEqIndex(0);
                setEqPlaying(false);
              }}
            />

            <div className="lesson-extras">
              <details className="trace-details">
                <summary>EquationTrace Details</summary>
                <div>
                  <p>
                    EquationTrace v{eqTrace.schemaVersion} · Trace ID: {eqTrace.traceId}
                  </p>
                  <p>
                    Active Function: {currentEquationStep?.functionName}(x) = {currentEquationStep?.expressionText}
                  </p>
                  <p>
                    Dependencies: {currentEquationStep?.dependencies.join(", ") || "None (Base Function)"}
                  </p>
                  <pre>
                    {JSON.stringify(
                      {
                        step: currentEquationStep,
                        diagnostics: eqTrace.diagnostics,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>
            </div>
          </section>

          <footer className="page-footer">
            <span>Visualized Equations · Original design: Takumi Naito</span>
            <span>Transformations first. Form follows math.</span>
          </footer>
        </main>
      )}
    </div>
  );
}
