/**
 * Extension Bridge for Visualized Systems (Visualized GDB & Visualized Equations)
 * Listens for incoming code/equations from the student browser extension
 * via URL query parameter (?code=..., ?mode=..., ?equations= / ?eq=...) or window.postMessage.
 */

export interface ExternalCodePayload {
  code: string;
  title?: string;
  source?: 'url_param' | 'post_message';
  mode?: 'gdb' | 'equations';
  /** Student's native language, when the extension sends one */
  language?: string;
  /** Lecture Lens server that answers /api/llm */
  apiBase?: string;
}

function decodeBase64Utf8(value: string): string {
  const bin = atob(value);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function decodeParam(value: string, isBase64: boolean): string {
  if (isBase64 || /^[A-Za-z0-9+/=]+$/.test(value)) {
    try {
      return decodeBase64Utf8(value);
    } catch {
      // Not valid base64 / UTF-8: use the raw value
    }
  }
  return value;
}

/** Only local servers may be named in the URL, so a shared link can't redirect snippets elsewhere. */
function localApiBase(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function checkUrlCodeParam(): ExternalCodePayload | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const codeParam = params.get('code');
    const eqParam = params.get('equations') ?? params.get('eq') ?? params.get('equation');
    const isEquations =
      modeParam === 'equations' || modeParam === 'math' || (!codeParam && eqParam !== null);
    const raw = isEquations ? (eqParam ?? codeParam) : codeParam;
    if (!raw) return null;

    return {
      code: decodeParam(raw, params.get('enc') === 'b64'),
      title: params.get('title') || (isEquations ? 'Imported Equations' : 'Imported C++ Snippet'),
      source: 'url_param',
      mode: isEquations ? 'equations' : 'gdb',
      language: params.get('lang') || undefined,
      apiBase: localApiBase(params.get('api')),
    };
  } catch (err) {
    console.warn('Failed to parse URL code param:', err);
    return null;
  }
}

/**
 * Turn highlighted maths (LaTeX, Unicode symbols, "y = ...") into lines the equation
 * tracer understands, e.g. "f(x) = (1)/(2)x^2". Line count is preserved so step
 * annotations still point at the right line.
 */
export function normalizeMathSnippet(input: string): string {
  const used = new Set(Array.from(input.matchAll(/\b([a-z])\s*\(\s*x\s*\)/g), (m) => m[1]));
  const freeNames = 'fghpqrsuvw'.split('').filter((n) => !used.has(n));
  let ySeen = 0;

  return input
    .split('\n')
    .map((line) => {
      let s = line
        .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, '')
        .replace(/\\left|\\right/g, '')
        .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
        .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
        .replace(/\\(cdot|times)/g, '*')
        .replace(/\\(sin|cos|tan|log|ln|exp|abs|pi)\b/g, '$1')
        .replace(/\\[,;! ]/g, ' ')
        .replace(/\{/g, '(')
        .replace(/\}/g, ')')
        .replace(/[×·∙]/g, '*')
        .replace(/÷/g, '/')
        .replace(/[−–]/g, '-')
        .replace(/²/g, '^2')
        .replace(/³/g, '^3')
        .replace(/π/g, 'pi')
        .replace(/[.,;]\s*$/, '');
      if (/^\s*y\s*=/.test(s)) {
        const name = freeNames[ySeen++] ?? `f${ySeen}`;
        s = s.replace(/^\s*y\s*=/, `${name}(x) =`);
      }
      return s;
    })
    .join('\n');
}

export function registerPostMessageListener(
  onCodeReceived: (payload: ExternalCodePayload) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.type === 'VISUALIZE_SNIPPET') {
      const code = event.data.payload;
      if (typeof code === 'string' && code.trim().length > 0) {
        const isMath = event.data.mode === 'math';
        onCodeReceived({
          code,
          title: isMath ? 'Imported Equations' : 'Extension Snippet',
          source: 'post_message',
          mode: isMath ? 'equations' : 'gdb',
          language: typeof event.data.language === 'string' ? event.data.language : undefined,
        });
      }
    } else if (event.data.type === 'VGDB_LOAD_CODE' || event.data.type === 'VSYSTEMS_LOAD_CODE') {
      const code = event.data.payload?.code;
      const mode = event.data.payload?.mode || 'gdb';
      if (typeof code === 'string' && code.trim().length > 0) {
        onCodeReceived({
          code,
          title: event.data.payload?.title || (mode === 'equations' ? 'Imported Equations' : 'Extension Snippet'),
          source: 'post_message',
          mode,
        });
      }
    } else if (event.data.type === 'VEQ_LOAD_CODE') {
      const code = event.data.payload?.code || event.data.payload?.equations;
      if (typeof code === 'string' && code.trim().length > 0) {
        onCodeReceived({
          code,
          title: event.data.payload?.title || 'Imported Equations',
          source: 'post_message',
          mode: 'equations',
        });
      }
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
