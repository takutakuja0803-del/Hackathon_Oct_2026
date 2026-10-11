import { useCallback, useEffect, useRef, useState } from "react";
import {
  requestScaffold,
  SCAFFOLD_LANGUAGES,
  type ScaffoldExplanation,
  type ScaffoldKind,
} from "../../services/scaffold";

export type ScaffoldStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: ScaffoldExplanation; snippet: string; language: string }
  | { state: "error"; message: string };

/** Explanations live in App so they survive switching between GDB and Equations. */
export function useScaffold(apiBase: string) {
  const [status, setStatus] = useState<Record<ScaffoldKind, ScaffoldStatus>>({
    code: { state: "idle" },
    math: { state: "idle" },
  });
  const controllers = useRef<Partial<Record<ScaffoldKind, AbortController>>>({});

  const explain = useCallback(
    async (kind: ScaffoldKind, snippet: string, language: string) => {
      if (!snippet.trim()) return;
      controllers.current[kind]?.abort();
      const controller = new AbortController();
      controllers.current[kind] = controller;
      setStatus((s) => ({ ...s, [kind]: { state: "loading" } }));
      try {
        const data = await requestScaffold(apiBase, kind, snippet, language, controller.signal);
        setStatus((s) => ({ ...s, [kind]: { state: "ready", data, snippet, language } }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setStatus((s) => ({ ...s, [kind]: { state: "error", message: (err as Error).message } }));
      }
    },
    [apiBase],
  );

  useEffect(() => {
    const active = controllers.current;
    return () => Object.values(active).forEach((c) => c?.abort());
  }, []);

  return { status, explain };
}

interface ScaffoldPanelProps {
  kind: ScaffoldKind;
  snippet: string;
  /** 1-based source line the visualizer is currently on */
  activeLine?: number;
  language: string;
  onLanguageChange: (language: string) => void;
  status: ScaffoldStatus;
  onExplain: (language: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function ScaffoldPanel({
  kind,
  snippet,
  activeLine,
  language,
  onLanguageChange,
  status,
  onExplain,
  open,
  onToggle,
}: ScaffoldPanelProps) {
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine, status]);

  if (!open) {
    return (
      <aside className="scaffold-panel collapsed" aria-label="Cognitive Scaffold / Translation">
        <button className="scaffold-tab" onClick={onToggle} aria-expanded="false">
          Cognitive Scaffold / Translation
        </button>
      </aside>
    );
  }

  const what = kind === "math" ? "equations" : "code";
  const stale =
    status.state === "ready" && (status.snippet !== snippet || status.language !== language);
  const languages = SCAFFOLD_LANGUAGES.includes(language)
    ? SCAFFOLD_LANGUAGES
    : [language, ...SCAFFOLD_LANGUAGES];

  return (
    <aside className="scaffold-panel" aria-label="Cognitive Scaffold / Translation">
      <div className="scaffold-header">
        <h2>Cognitive Scaffold / Translation</h2>
        <button className="scaffold-close" onClick={onToggle} aria-expanded="true" title="Collapse">
          ✕
        </button>
      </div>

      <div className="scaffold-controls">
        <label>
          <span>Your language</span>
          <select
            value={language}
            onChange={(e) => {
              onLanguageChange(e.target.value);
              if (status.state === "ready") onExplain(e.target.value);
            }}
          >
            {languages.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <button
          className="scaffold-explain"
          onClick={() => onExplain(language)}
          disabled={status.state === "loading" || !snippet.trim()}
        >
          {status.state === "ready" ? "Explain again" : `Explain this ${what}`}
        </button>
      </div>

      {status.state === "idle" && (
        <p className="scaffold-hint">
          Get a simple explanation of this {what} and a note for every line, in English and{" "}
          {language}.
        </p>
      )}
      {status.state === "loading" && <p className="scaffold-hint">Writing explanations…</p>}
      {status.state === "error" && (
        <p className="scaffold-error" role="alert">
          {status.message}
        </p>
      )}

      {status.state === "ready" && (
        <>
          {stale && (
            <p className="scaffold-hint">
              The {what} or language changed. Press “Explain again” to update.
            </p>
          )}
          <section className="scaffold-eli5">
            <h3>Explain like I’m 5</h3>
            {status.data.eli5.native && <p className="native">{status.data.eli5.native}</p>}
            {status.data.eli5.english && status.data.eli5.english !== status.data.eli5.native && (
              <p className="english">{status.data.eli5.english}</p>
            )}
          </section>
          {status.data.steps.length > 0 && (
            <section>
              <h3>Step by step</h3>
              <ol className="scaffold-steps">
                {status.data.steps.map((s, i) => {
                  const active = !stale && !!activeLine && s.line === activeLine;
                  return (
                    <li
                      key={`${s.line}-${i}`}
                      ref={active ? activeRef : undefined}
                      className={active ? "active" : undefined}
                    >
                      <div className="scaffold-line">
                        <span className="line-no">{s.line || "·"}</span>
                        <code>{s.code}</code>
                      </div>
                      {s.native && <p className="native">{s.native}</p>}
                      {s.english && s.english !== s.native && (
                        <p className="english">{s.english}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          <p className="scaffold-note">AI can make mistakes. Check important details.</p>
        </>
      )}
    </aside>
  );
}
