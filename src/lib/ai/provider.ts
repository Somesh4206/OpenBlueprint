// OpenBlueprint AI — OpenAI-compatible provider.
// Same wire schema as `import OpenAI from 'openai'`:
//   client = OpenAI(api_key, base_url)
//   client.chat.completions.create({ model, reasoning_effort, messages: [
//     { role: 'system', ... }, { role: 'user', ... }] })
//
// Works with OpenAI directly AND any OpenAI-compatible endpoint
// (Gemini OpenAI-compat, Azure, Ollama, LM Studio, Together, OpenRouter...).
//
// Config resolution (server): request headers > process.env.
//   x-openai-key, x-openai-base-url, x-openai-model, x-openai-reasoning
//   OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, OPENAI_REASONING_EFFORT
// Client helpers read/write localStorage so the key can also be set
// from the wizard UI without redeploying.
//
// Retry policy (user requirement): on retryable failures (429, 5xx,
// network errors, timeouts) wait 2s → 10s → 30s between attempts
// (final wait budget ≈ 1 min). 401/403 fail fast — retrying a bad key
// is pointless. A 400 that complains about `reasoning_effort` is
// retried once WITHOUT the param (older / minimal compat servers).

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 'low' | 'medium' | 'high' — forwarded as reasoning_effort */
  reasoningEffort: string;
}

export const DEFAULT_BASE_URL = 'https://api.inceptionlabs.ai/v1';
export const DEFAULT_MODEL = 'mercury-2.5';
export const DEFAULT_REASONING_EFFORT = 'low';

export const LS_KEY = 'ob-ai-key';
export const LS_BASE = 'ob-ai-base-url';
export const LS_MODEL = 'ob-ai-model';
export const LS_REASONING = 'ob-ai-reasoning';

const RETRY_DELAYS_MS = [1000, 3000, 8000];

export function clientAIConfig(): Partial<AIConfig> {
  if (typeof window === 'undefined') return {};
  try {
    return {
      apiKey: window.localStorage.getItem(LS_KEY) || '',
      baseUrl: window.localStorage.getItem(LS_BASE) || '',
      model: window.localStorage.getItem(LS_MODEL) || '',
      reasoningEffort: window.localStorage.getItem(LS_REASONING) || '',
    };
  } catch {
    return {};
  }
}

export function saveClientAIConfig(c: Partial<AIConfig>) {
  try {
    if (c.apiKey !== undefined) window.localStorage.setItem(LS_KEY, c.apiKey);
    if (c.baseUrl !== undefined) window.localStorage.setItem(LS_BASE, c.baseUrl);
    if (c.model !== undefined) window.localStorage.setItem(LS_MODEL, c.model);
    if (c.reasoningEffort !== undefined) window.localStorage.setItem(LS_REASONING, c.reasoningEffort);
  } catch {
    /* storage unavailable */
  }
}

export function serverAIConfig(headers?: Headers): AIConfig {
  const h = (n: string) => (headers?.get(n) || '').trim();
  const apiKey = h('x-openai-key') || process.env.OPENAI_API_KEY || '';
  const baseUrl = (
    h('x-openai-base-url') ||
    process.env.OPENAI_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
  const model = h('x-openai-model') || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const reasoningEffort =
    h('x-openai-reasoning') || process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT;
  return { apiKey, baseUrl, model, reasoningEffort };
}

export function isAIConfigured(c: Pick<AIConfig, 'apiKey'>): boolean {
  return c.apiKey.length > 4;
}

export class AIMissingError extends Error {
  constructor() {
    super('AI key missing. Add your OpenAI-compatible API key to generate blueprints.');
    this.name = 'AIMissingError';
  }
}

/** Thrown when the model hits max_tokens mid-answer (finish_reason=length). */
export class AITruncatedError extends Error {
  constructor() {
    super('AI_TRUNCATED');
    this.name = 'AITruncatedError';
  }
}

export interface ChatOpts {
  temperature?: number;
  maxTokens?: number;
  /** per-attempt fetch timeout ms (default 45000) */
  timeoutMs?: number;
  /** override reasoning effort for this call */
  reasoningEffort?: string;
  /** extra backoff delays (default 2s/10s/30s) */
  retryDelaysMs?: number[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Loose JSON extraction: strips thought blocks + fences, slices to outer braces. */
export function parseJsonLoose<T = Record<string, unknown>>(raw: string): T {
  let s = (raw || '').trim();
  // Some models (Gemma) wrap hidden reasoning in <thought>/<think> tags.
  s = s.replace(/<(thought|think)>[\s\S]*?<\/\1>/gi, '').trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}

interface PostBody {
  model: string;
  reasoning_effort?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
  messages: { role: string; content: string }[];
}

/**
 * Single POST to {baseUrl}/chat/completions with timeout.
 * Returns { status, content, rawBody } — never throws except on abort/network.
 */
async function attempt(
  cfg: AIConfig,
  body: PostBody,
  timeoutMs: number,
): Promise<{ status: number; content: string; rawBody: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const rawBody = await res.text().catch(() => '');
    let content = '';
    let finishReason = '';
    try {
      const data = JSON.parse(rawBody);
      content = data?.choices?.[0]?.message?.content || '';
      finishReason = data?.choices?.[0]?.finish_reason || '';
      if (!content && data?.choices?.[0]?.message?.reasoning_content) {
        // Some compat servers put thinking output separately — not the answer.
        content = '';
      }
    } catch {
      content = '';
    }
    // Thinking models can exhaust max_tokens on reasoning, truncating the
    // visible answer mid-JSON. Never accept a truncated payload as final.
    if (finishReason === 'length') {
      return { status: 529, content: '', rawBody: 'Response truncated by max_tokens (finish_reason=length).' };
    }
    return { status: res.status, content, rawBody };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Core chat with retry. Throws AIMissingError / Error with provider message.
 */
async function postChat(
  cfg: AIConfig,
  system: string,
  user: string,
  opts: ChatOpts & { json: boolean },
): Promise<string> {
  if (!isAIConfigured(cfg)) throw new AIMissingError();

  const delays = opts.retryDelaysMs ?? RETRY_DELAYS_MS;
  const timeoutMs = opts.timeoutMs ?? 45000;
  const effort = opts.reasoningEffort ?? cfg.reasoningEffort;

  const buildBody = (withReasoning: boolean): PostBody => {
    const b: PostBody = {
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    if (withReasoning && effort) b.reasoning_effort = effort;
    if (opts.temperature !== undefined) b.temperature = opts.temperature;
    else b.temperature = 0.2;
    if (opts.maxTokens !== undefined) b.max_tokens = opts.maxTokens;
    if (opts.json) {
      b.max_tokens = b.max_tokens ?? 3000;
      b.response_format = { type: 'json_object' };
    } else {
      b.max_tokens = b.max_tokens ?? 800;
    }
    return b;
  };

  let withReasoning = true;
  let strippedReasoning = false;
  let attemptIdx = 0;
  let lastError = '';

  // Total attempts = 1 + delays.length (default 4: immediate, +2s, +10s, +30s)
  for (;;) {
    let result: { status: number; content: string; rawBody: string };
    try {
      result = await attempt(cfg, buildBody(withReasoning), timeoutMs);
    } catch (e) {
      // Network-level failure (DNS, refused, aborted timeout) → retryable.
      lastError = e instanceof Error ? e.message : String(e);
      if (attemptIdx < delays.length) {
        await sleep(delays[attemptIdx]);
        attemptIdx++;
        continue;
      }
      throw new Error(`AI request failed after ${attemptIdx + 1} attempts: ${lastError}`);
    }

    const { status, content, rawBody } = result;

    // Internal 529 = truncated by max_tokens. Retrying at the SAME budget
    // is pointless — the caller must raise it (see requestAIPlan escalation).
    if (status === 529) {
      throw new AITruncatedError();
    }

    if (status >= 200 && status < 300) {
      if (!content) {
        lastError = 'AI provider returned an empty response.';
        if (attemptIdx < delays.length) {
          await sleep(delays[attemptIdx]);
          attemptIdx++;
          continue;
        }
        throw new Error(lastError);
      }
      return content;
    }

    if (status === 401 || status === 403) {
      throw new Error('AI key rejected by provider (401/403). Check your API key.');
    }

    if (status === 402) {
      throw new Error(
        'AI credits exhausted (402): this model is paid and the account is out of credits. Add credits at the provider dashboard, or switch OPENAI_MODEL to a free model.',
      );
    }

    // Compat fallback: server doesn't know reasoning_effort ("reasoning" /
    // "thinking" level unsupported) → retry once without it.
    if (status === 400 && withReasoning && !strippedReasoning && /reasoning|thinking/i.test(rawBody)) {
      strippedReasoning = true;
      withReasoning = false;
      continue;
    }

    if (isRetryableStatus(status) && attemptIdx < delays.length) {
      lastError = `AI provider error (${status}): ${rawBody.slice(0, 200)}`;
      await sleep(delays[attemptIdx]);
      attemptIdx++;
      continue;
    }

    throw new Error(`AI provider error (${status}): ${rawBody.slice(0, 300)}`);
  }
}

/** JSON chat (blueprint plans, assistant actions). Retries per policy. */
export async function chatJSON<T>(
  cfg: AIConfig,
  system: string,
  user: string,
  opts: ChatOpts = {},
): Promise<T> {
  const content = await postChat(cfg, system, user, { ...opts, json: true });
  try {
    return parseJsonLoose<T>(content);
  } catch {
    throw new Error(`AI returned non-JSON output: ${content.slice(0, 200)}`);
  }
}

/** Plain-text chat (knowledge answers, explanations). Retries per policy. */
export async function chatText(
  cfg: AIConfig,
  system: string,
  user: string,
  opts: ChatOpts = {},
): Promise<string> {
  return postChat(cfg, system, user, { ...opts, json: false });
}
