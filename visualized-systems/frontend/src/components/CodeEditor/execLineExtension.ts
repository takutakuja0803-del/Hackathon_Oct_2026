import { StateEffect, StateField, RangeSet } from '@codemirror/state';
import { EditorView, Decoration, gutter, GutterMarker } from '@codemirror/view';

// StateEffect to update the current execution line (1-indexed, or null if none)
export const setActiveLineEffect = StateEffect.define<number | null>();

class ExecGutterMarker extends GutterMarker {
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-gutter-exec-marker text-[#38bdf8] font-bold text-xs pl-1 select-none';
    span.textContent = '▶';
    return span;
  }
}

const execMarker = new ExecGutterMarker();

// StateField tracking the active line
export const activeLineField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(currentLine, tr) {
    for (const e of tr.effects) {
      if (e.is(setActiveLineEffect)) {
        return e.value;
      }
    }
    return currentLine;
  },
  provide(field) {
    return EditorView.decorations.from(field, (lineNum) => {
      if (!lineNum || lineNum < 1) return Decoration.none;
      return (view: EditorView) => {
        if (lineNum > view.state.doc.lines) return Decoration.none;
        const line = view.state.doc.line(lineNum);
        return Decoration.set([
          Decoration.line({
            class: 'cm-active-exec-line',
          }).range(line.from),
        ]);
      };
    });
  },
});

export const execGutterExtension = gutter({
  class: 'cm-exec-gutter',
  markers(view) {
    const activeLine = view.state.field(activeLineField, false);
    if (!activeLine || activeLine < 1 || activeLine > view.state.doc.lines) {
      return RangeSet.empty;
    }
    const line = view.state.doc.line(activeLine);
    return RangeSet.of([execMarker.range(line.from)]);
  },
});
