import type { EquationStep } from "@visualized-gdb/equation-trace";

interface EquationStepperProps {
  currentStepIndex: number;
  totalSteps: number;
  currentStep?: EquationStep;
  isPlaying: boolean;
  onStepChange: (index: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
}

export function EquationStepper({
  currentStepIndex,
  totalSteps,
  currentStep,
  isPlaying,
  onStepChange,
  onTogglePlay,
  onReset,
}: EquationStepperProps) {
  const canGoBack = currentStepIndex > 0;
  const canGoNext = currentStepIndex < totalSteps - 1;

  return (
    <div className="equation-stepper-container">
      {/* Transformation explanation callout */}
      {currentStep && (
        <div className="change-story equation-story" aria-live="polite">
          <span className="story-mark" aria-hidden="true">
            ↳
          </span>
          <div className="story-content">
            <div className="story-header">
              <strong className="story-fn">
                Line {currentStep.sourceLine}: {currentStep.functionName}({currentStep.parameterName}) = {currentStep.expressionText}
              </strong>
              {currentStep.transformations.map((t, idx) => (
                <span key={idx} className="transformation-tag">
                  {t.kind.replace("-", " ").toUpperCase()}
                  {t.parameter !== undefined ? ` (${t.parameter > 0 ? `+${t.parameter}` : t.parameter})` : ""}
                </span>
              ))}
            </div>
            <p className="story-narrative">{currentStep.explanation}</p>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="lesson-controls">
        <div className="playback-controls">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            title={isPlaying ? "Pause auto-stepping" : "Play auto-stepping"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset to step 1"
            title="Reset to step 1"
          >
            ⟲
          </button>
        </div>

        <div className="step-controls">
          <button
            type="button"
            className="back-button"
            onClick={() => onStepChange(currentStepIndex - 1)}
            disabled={!canGoBack}
          >
            ‹ Back
          </button>

          <div className="step-dots" role="tablist" aria-label="Equation steps">
            {Array.from({ length: totalSteps }).map((_, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Step ${idx + 1}`}
                  onClick={() => onStepChange(idx)}
                >
                  <span
                    className={
                      isActive ? "active" : isPast ? "past" : ""
                    }
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="next-button"
            onClick={() => onStepChange(currentStepIndex + 1)}
            disabled={!canGoNext}
          >
            Next ›
          </button>
        </div>

        <div className="step-count">
          <strong>Step {currentStepIndex + 1} of {Math.max(1, totalSteps)}</strong>
          <small>{currentStep?.functionName || "f"}(x)</small>
        </div>
      </div>
    </div>
  );
}
