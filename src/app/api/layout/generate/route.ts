import { NextRequest, NextResponse } from 'next/server';
import { ProjectConfig } from '@/lib/types';
import {
  expandRequirements,
  generateAIDesignOptions,
  generateDesignOptions,
} from '@/lib/layout/engine';
import { validateLayout } from '@/lib/layout/validation';
import { AIPlan, PlanAnswers, requestAIPlan } from '@/lib/ai/blueprint-planner';
import { AIMissingError, AITruncatedError, isAIConfigured, serverAIConfig } from '@/lib/ai/provider';

// ── Draft-plan cache ────────────────────────────────────────────────────
// When the AI returns clarifying questions (human-in-the-loop), the draft
// plan is cached here. When the user submits answers, we reuse the cached
// plan instead of making a 2nd LLM call — this eliminates the 2-4 minute
// duplicate wait that was causing client-side timeouts.
const PLAN_CACHE = new Map<string, { plan: AIPlan; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(config: ProjectConfig): string {
  // Stable key from plot + rooms + floor assignment — same config always hits the same cache.
  // Including floorAssignment ensures a changed floor distribution (from the
  // human-in-the-loop dialog) invalidates the cached plan.
  const base = `${config.plot.width}x${config.plot.length}-${config.rooms.map(r => `${r.type}:${r.count}`).join(',')}`;
  const fa = config.floorAssignment
    ? `-fa:${Object.entries(config.floorAssignment).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v.join('.')}`).join(',')}`
    : '';
  return `${base}${fa}`;
}

function pruneCache(): void {
  const now = Date.now();
  for (const [k, v] of PLAN_CACHE) {
    if (now - v.ts > CACHE_TTL_MS) PLAN_CACHE.delete(k);
  }
}

/**
 * AI-first blueprint generation.
 *
 * POST { config, answers? } →
 *  - 428 { error: 'AI_KEY_MISSING' } when no OpenAI-compatible key is set
 *      (header x-openai-key or OPENAI_API_KEY). Generation is blocked by design:
 *      OpenBlueprint AI must reason before placing rooms.
 *  - 422 { needsClarification: questions, draftReasoning } when the AI planner
 *      is unsure (human-in-the-loop). Client shows the questions, resubmits
 *      with `answers`, and generation completes INSTANTLY from the cached plan.
 *  - 200 { designs, reasoning, assumptions, aiPlanned: true } on success.
 *  - On provider failure: 502 with the provider message (no silent fallback —
 *      a silently dumb plan is worse than an explicit error).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    config: ProjectConfig;
    answers?: PlanAnswers;
    offline?: boolean;
    /** client retry count — each retry raises the model's output budget */
    attempt?: number;
  };
  const config = body.config;
  if (!config?.plot || !Array.isArray(config.rooms)) {
    return NextResponse.json({ error: 'Invalid project config.' }, { status: 400 });
  }

  // Explicit offline escape hatch (tests, local dev without a key).
  if (body.offline) {
    return NextResponse.json({
      designs: generateDesignOptions(config),
      reasoning: '',
      assumptions: [] as string[],
      aiPlanned: false,
    });
  }

  const aiCfg = serverAIConfig(req.headers);
  if (!isAIConfigured(aiCfg)) {
    return NextResponse.json(
      {
        error: 'AI_KEY_MISSING',
        message:
          'Add your OpenAI-compatible API key to generate blueprints. OpenBlueprint AI reasons about zoning, adjacency, and doors before placing rooms — it cannot generate without the AI.',
      },
      { status: 428 },
    );
  }

  const expanded = expandRequirements(config.rooms);
  const expandedNames = expanded.map((r) => r.name);
  const key = cacheKey(config);

  // ── Fast path: user submitted answers → reuse cached draft plan ──────
  if (body.answers && Object.keys(body.answers).length > 0) {
    const cached = PLAN_CACHE.get(key);
    if (cached) {
      PLAN_CACHE.delete(key);
      // Clear questions so the plan is treated as final
      const plan: AIPlan = { ...cached.plan, questions: [] };
      const { designs, reasoning, assumptions } = generateAIDesignOptions(config, plan);
      const allInvalid = designs.every((d) => !validateLayout(d.layout, config).valid);
      return NextResponse.json({
        designs,
        reasoning,
        assumptions,
        aiPlanned: true,
        allInvalid,
      });
    }
    // Cache miss (expired / different config) — fall through to a fresh LLM call
  }

  // attempt N → +3000 output tokens each retry (the planner also
  // self-escalates once per call, so retries always run a bigger budget).
  const budgetBoost = Math.max(0, Math.min(2, Math.floor(body.attempt || 0))) * 3000;
  let plan: AIPlan;
  try {
    plan = await requestAIPlan(aiCfg, config, expandedNames, body.answers, undefined, budgetBoost);
  } catch (e) {
    if (e instanceof AIMissingError) {
      return NextResponse.json({ error: 'AI_KEY_MISSING', message: e.message }, { status: 428 });
    }
    if (e instanceof AITruncatedError) {
      return NextResponse.json(
        {
          error: 'AI_TRUNCATED',
          message:
            'The AI ran out of room mid-plan even with a bigger budget. Hit Retry (it raises the budget again), split rooms across more floors, or continue without AI.',
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: 'AI_PROVIDER_ERROR', message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // Human-in-the-loop: the AI has doubts → cache the plan, ask the user.
  // When they answer, the fast path above skips the 2nd LLM call entirely.
  if (plan.questions.length > 0 && !body.answers) {
    pruneCache();
    PLAN_CACHE.set(key, { plan, ts: Date.now() });
    return NextResponse.json(
      {
        needsClarification: plan.questions,
        draftReasoning: plan.reasoning,
        draftAssumptions: plan.assumptions,
      },
      { status: 422 },
    );
  }

  const { designs, reasoning, assumptions } = generateAIDesignOptions(config, plan);

  // Safety net: if every variant violates hard rules, report it honestly.
  const allInvalid = designs.every((d) => !validateLayout(d.layout, config).valid);
  return NextResponse.json({
    designs,
    reasoning,
    assumptions,
    aiPlanned: true,
    allInvalid,
  });
}

