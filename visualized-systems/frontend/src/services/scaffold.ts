/**
 * Cognitive Scaffold: asks the Lecture Lens server (/api/llm, mode "ast_explain") for an
 * explain-like-I'm-5 summary and per-line annotations in English and the student's language.
 */

export type ScaffoldKind = 'code' | 'math';

export interface BilingualText {
  english: string;
  native: string;
}

export interface ScaffoldStep extends BilingualText {
  line: number;
  code: string;
}

export interface ScaffoldExplanation {
  eli5: BilingualText;
  steps: ScaffoldStep[];
}

export const DEFAULT_API_BASE = 'http://localhost:5173';

export const SCAFFOLD_LANGUAGES = [
  'Spanish', 'Mandarin Chinese', 'Hindi', 'Arabic', 'French', 'Portuguese', 'Korean',
  'Japanese', 'Vietnamese', 'Russian', 'German', 'Tagalog', 'Bengali', 'Urdu', 'Persian',
  'Turkish', 'Italian', 'Polish', 'Ukrainian', 'English',
];

const LANG_KEY = 'vs.scaffoldLanguage';

export function browserLanguage(): string {
  try {
    const code = (navigator.language || 'en').split('-')[0];
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    if (code === 'zh') return 'Mandarin Chinese';
    return name || 'English';
  } catch {
    return 'English';
  }
}

export function loadScaffoldLanguage(fromUrl?: string): string {
  if (fromUrl) return fromUrl;
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored) return stored;
  } catch {
    // Storage unavailable (private mode): fall through
  }
  return browserLanguage();
}

export function saveScaffoldLanguage(language: string): void {
  try {
    localStorage.setItem(LANG_KEY, language);
  } catch {
    // Not fatal: the choice just won't persist
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseScaffold(text: string): ScaffoldExplanation {
  const cleaned = text.replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The explanation came back in an unexpected format.');
  const obj = JSON.parse(cleaned.slice(start, end + 1));

  const steps: ScaffoldStep[] = Array.isArray(obj.steps)
    ? obj.steps
        .map((s: any) => ({
          line: Number(s?.line) || 0,
          code: str(s?.code),
          english: str(s?.english),
          native: str(s?.native),
        }))
        .filter((s: ScaffoldStep) => s.english || s.native)
    : [];

  const eli5 = { english: str(obj.eli5?.english), native: str(obj.eli5?.native) };
  if (!eli5.english && !eli5.native && steps.length === 0) {
    throw new Error('The explanation was empty.');
  }
  return { eli5, steps };
}

export async function requestScaffold(
  apiBase: string,
  kind: ScaffoldKind,
  snippet: string,
  nativeLanguage: string,
  signal?: AbortSignal,
): Promise<ScaffoldExplanation> {
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/llm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'ast_explain', tier: 'fast', kind, snippet, nativeLanguage }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error(`Could not reach the Lecture Lens server at ${apiBase}. Start it with "node server.js".`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);
  return parseScaffold(String(data.text || ''));
}
