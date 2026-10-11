import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const appleLightTheme = EditorView.theme(
  {
    '&': {
      color: '#17181a',
      backgroundColor: '#ffffff',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#0066cc',
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: '13.5px',
      lineHeight: '1.7',
      color: '#17181a',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#0066cc',
      borderLeftWidth: '2.5px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(0, 102, 204, 0.18) !important',
    },
    '.cm-panels': {
      backgroundColor: '#f8fafc',
      color: '#17181a',
    },
    '.cm-gutters': {
      backgroundColor: '#f8fafc',
      color: '#62666d',
      borderRight: '1px solid rgba(20, 24, 30, 0.12)',
      fontWeight: '600',
      fontSize: '12px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(0, 102, 204, 0.12)',
      color: '#0066cc',
      fontWeight: '700',
    },
  },
  { dark: false }
);

export const appleHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#9333ea', fontWeight: '700' }, // Vibrant purple keyword
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#17181a', fontWeight: '500' },
  { tag: [t.function(t.variableName), t.labelName], color: '#0369a1', fontWeight: '600' }, // Crisp blue/teal for functions
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#b45309', fontWeight: '600' },
  { tag: [t.definition(t.name), t.separator], color: '#17181a' },
  { tag: [t.typeName, t.className, t.annotation, t.modifier, t.self, t.namespace], color: '#0891b2', fontWeight: '700' }, // Crisp teal for types
  { tag: t.number, color: '#1d4ed8', fontWeight: '600' }, // Crisp blue for numbers
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#17181a', fontWeight: '600' },
  { tag: [t.meta, t.comment], color: '#64748b', fontStyle: 'italic' }, // Slate-500 italic for comments
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: '#0066cc', textDecoration: 'underline' },
  { tag: [t.atom, t.bool], color: '#9333ea', fontWeight: '700' },
  { tag: [t.string, t.inserted, t.processingInstruction], color: '#b91c1c', fontWeight: '500' }, // Dark red for strings
  { tag: t.invalid, color: '#e11d48' },
]);

export const appleCodeMirrorExtensions: Extension = [
  appleLightTheme,
  syntaxHighlighting(appleHighlightStyle),
];
