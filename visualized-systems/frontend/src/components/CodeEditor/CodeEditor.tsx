import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { cpp } from "@codemirror/lang-cpp";
import { appleCodeMirrorExtensions } from "./codeMirrorTheme";
import {
  activeLineField,
  execGutterExtension,
  setActiveLineEffect,
} from "./execLineExtension";

interface Props {
  sourceCode: string;
  activeLine: number;
  fileName?: string;
  readOnly?: boolean;
  onCodeChange?: (s: string) => void;
}

export function CodeEditor({
  sourceCode,
  activeLine,
  fileName = "main.cpp",
  readOnly = true,
  onCodeChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: sourceCode,
        extensions: [
          lineNumbers(),
          cpp(),
          appleCodeMirrorExtensions,
          activeLineField,
          execGutterExtension,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ "aria-label": "C++ source" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onCodeChange) {
              onCodeChange(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: container.current,
    });
    editor.current = view;
    return () => {
      view.destroy();
      editor.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    if (doc !== sourceCode)
      view.dispatch({
        changes: { from: 0, to: doc.length, insert: sourceCode },
      });
    view.dispatch({ effects: setActiveLineEffect.of(activeLine) });
  }, [sourceCode, activeLine]);

  return (
    <div className="source-view">
      <div className="source-heading">
        <span>{fileName}</span>
        <span>
          {activeLine > 0 ? `Line ${activeLine}` : "Location unknown"}
        </span>
      </div>
      <div ref={container} className="editor-content" />
    </div>
  );
}
