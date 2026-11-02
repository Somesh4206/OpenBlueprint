'use client';

// Attach the user's OpenAI-compatible credentials (stored in localStorage
// via the wizard key setup) to API calls. Server prefers these headers,
// falling back to OPENAI_* env vars.
import { clientAIConfig } from './provider';

export function aiHeaders(): Record<string, string> {
  const c = clientAIConfig();
  const h: Record<string, string> = {};
  if (c.apiKey) h['x-openai-key'] = c.apiKey;
  if (c.baseUrl) h['x-openai-base-url'] = c.baseUrl;
  if (c.model) h['x-openai-model'] = c.model;
  return h;
}

export class RequestCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'RequestCancelled';
  }
}

export async function postJSON<T>(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ status: number; data: T }> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  const timer = opts.timeoutMs ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch (e) {
    if (ctrl.signal.aborted) {
      // Client-side cancel/timeout: surface distinctly so callers don't
      // silently fall back — the user chose to stop or the call overran.
      throw new RequestCancelled();
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
