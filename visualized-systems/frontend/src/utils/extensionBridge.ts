/**
 * Extension Bridge for Visualized Systems (Visualized GDB & Visualized Equations)
 * Listens for incoming code/equations from the student browser extension
 * via URL query parameter (?code=..., ?mode=..., ?equations=...) or window.postMessage.
 */

export interface ExternalCodePayload {
  code: string;
  title?: string;
  source?: 'url_param' | 'post_message';
  mode?: 'gdb' | 'equations';
}

export function checkUrlCodeParam(): ExternalCodePayload | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const isEquations = modeParam === 'equations';
    const codeParam = params.get('code') || (isEquations ? params.get('equations') : null);
    if (!codeParam) return null;

    let decodedCode = codeParam;
    // Check if base64 encoded
    try {
      if (/^[A-Za-z0-9+/=]+$/.test(codeParam)) {
        decodedCode = atob(codeParam);
      }
    } catch {
      // Use raw param if atob fails
    }

    return {
      code: decodedCode,
      title: params.get('title') || (isEquations ? 'Imported Equations' : 'Imported C++ Snippet'),
      source: 'url_param',
      mode: isEquations ? 'equations' : 'gdb',
    };
  } catch (err) {
    console.warn('Failed to parse URL code param:', err);
    return null;
  }
}

export function registerPostMessageListener(
  onCodeReceived: (payload: ExternalCodePayload) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.type === 'VGDB_LOAD_CODE' || event.data.type === 'VSYSTEMS_LOAD_CODE') {
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
