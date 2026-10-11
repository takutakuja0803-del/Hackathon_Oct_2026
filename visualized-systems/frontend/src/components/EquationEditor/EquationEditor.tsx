import { type ChangeEvent } from "react";

interface EquationEditorProps {
  code: string;
  onChange: (code: string) => void;
  activeLine?: number;
  readOnly?: boolean;
  onTrace?: () => void;
}

export function EquationEditor({
  code,
  onChange,
  activeLine,
  readOnly = false,
  onTrace,
}: EquationEditorProps) {
  const lines = code.split("\n");

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="equation-editor">
      <div className="equation-editor-chrome">
        <div className="equation-editor-body">
          {/* Line number gutter with active marker */}
          <div className="equation-gutter" aria-hidden="true">
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const isActive = lineNum === activeLine;
              return (
                <div
                  key={idx}
                  className={`gutter-cell ${isActive ? "active" : ""}`}
                >
                  <span className="gutter-marker">{isActive ? "→" : ""}</span>
                  <span className="gutter-num">{lineNum}</span>
                </div>
              );
            })}
          </div>

          {/* Textarea */}
          <div className="equation-textarea-wrap">
            <textarea
              className="equation-textarea"
              value={code}
              onChange={handleChange}
              readOnly={readOnly}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              rows={Math.max(8, lines.length)}
              placeholder="e.g.&#10;f(x) = x^2&#10;g(x) = f(x) + 3"
            />
          </div>
        </div>
      </div>

      {onTrace && (
        <div className="equation-editor-actions">
          <button
            type="button"
            className="trace-update-btn"
            onClick={onTrace}
          >
            Update Trace
          </button>
        </div>
      )}
    </div>
  );
}
