import { useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
interface Props {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onStepChange: (n: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (n: number) => void;
  onReset: () => void;
}
export function StepperBar({
  currentStepIndex: i,
  totalSteps: total,
  isPlaying,
  playbackSpeed,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
  onReset,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,select,button,a,[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onStepChange(i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStepChange(i - 1);
      } else if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === "Home") {
        e.preventDefault();
        onReset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [i, total, onStepChange, onTogglePlay, onReset]);
  return (
    <nav className="lesson-controls" aria-label="Execution timeline">
      <div className="playback-controls">
        <button
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button aria-label="Restart" onClick={onReset}>
          <RotateCcw size={15} />
        </button>
        <button
          aria-label="Toggle playback speed"
          onClick={() => onSpeedChange(playbackSpeed === 1000 ? 500 : 1000)}
        >
          {playbackSpeed === 500 ? "2×" : "1×"}
        </button>
      </div>
      <div className="step-controls">
        <button
          className="back-button"
          disabled={i === 0}
          onClick={() => onStepChange(i - 1)}
        >
          <ChevronLeft size={17} />
          Back
        </button>
        <div className="step-dots">
          {Array.from({ length: total }, (_, n) => (
            <button
              key={n}
              aria-label={`Step ${n + 1}`}
              aria-current={n === i ? "step" : undefined}
              onClick={() => onStepChange(n)}
            >
              <span className={n === i ? "active" : n < i ? "past" : ""} />
            </button>
          ))}
        </div>
        <button
          className="next-button"
          disabled={i === total - 1}
          onClick={() => onStepChange(i + 1)}
        >
          Next
          <ChevronRight size={17} />
        </button>
      </div>
      <span className="step-count">
        {i + 1} / {total}
        <small>← → to explore</small>
      </span>
    </nav>
  );
}
