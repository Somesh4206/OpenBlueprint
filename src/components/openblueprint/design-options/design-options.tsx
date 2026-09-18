'use client';

import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { Brand } from '@/components/openblueprint/brand';
import { MiniPlan } from '@/components/openblueprint/mini-plan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  ArrowRight,
  Gauge,
  Wind,
  Maximize,
  CheckCircle2,
  GitCompareArrows,
  Trophy,
  RotateCcw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ProjectConfig, ScoredLayout, LayoutData } from '@/lib/types';
import { generateDesignOptions } from '@/lib/layout/engine';
import { scoreBreakdownBars } from '@/lib/layout/scoring';
import { postJSON, RequestCancelled } from '@/lib/ai/client';
import type { ClarifyingQuestion } from '@/lib/ai/blueprint-planner';
import { cn } from '@/lib/utils';

interface Props {
  config: ProjectConfig;
  designs: ScoredLayout[];
}

type Phase = 'loading' | 'ready' | 'clarify' | 'error';

const PLAN_STAGES = [
  'AI reasoning about zones, entry sequence, and adjacencies…',
  'Placing every room from your requirements — preferences applied…',
  'Solving doors on real shared walls (no randomness)…',
  'Validating 8 architectural rules + scoring 5 variants…',
];

export function DesignOptions({ config, designs: initialDesigns }: Props) {
  const setView = useApp((s) => s.setView);
  const setDesigns = useApp((s) => s.setDesigns);
  const enterWorkspace = useApp((s) => s.enterWorkspace);
  const [designs, setLocalDesigns] = useState<ScoredLayout[]>(initialDesigns);
  const [phase, setPhase] = useState<Phase>(initialDesigns.length === 0 ? 'loading' : 'ready');
  const [stage, setStage] = useState(0);
  const [reasoning, setReasoning] = useState(
    () => initialDesigns.find((d) => d.reasoning)?.reasoning || '',
  );
  const [assumptions, setAssumptions] = useState<string[]>(
    () => initialDesigns.find((d) => d.assumptions)?.assumptions || [],
  );
  const [aiPlanned, setAiPlanned] = useState(initialDesigns.some((d) => d.aiPlanned));
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [draftReasoning, setDraftReasoning] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [compare, setCompare] = useState<ScoredLayout[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const fetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Retry counter → server raises the model's output budget per attempt,
  // so a truncation never fails the same way twice.
  const attemptsRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  async function fetchDesigns(chosen?: Record<string, string>, offline = false) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (!offline) attemptsRef.current += 1;
    setPhase('loading');
    setStage(0);
    setElapsed(0);
    try {
      const { status, data } = await postJSON<{
        designs?: ScoredLayout[]; reasoning?: string; assumptions?: string[];
        aiPlanned?: boolean; needsClarification?: ClarifyingQuestion[];
        draftReasoning?: string; message?: string; error?: string;
      }>('/api/layout/generate', { config, answers: chosen, offline, attempt: attemptsRef.current }, { timeoutMs: 120000, signal: ctrl.signal });
      if (status === 200 && data.designs) {
        setLocalDesigns(data.designs);
        setDesigns(data.designs);
        setReasoning(data.reasoning || '');
        setAssumptions(data.assumptions || []);
        setAiPlanned(!!data.aiPlanned);
        setPhase('ready');
      } else if (status === 422 && data.needsClarification) {
        // Human-in-the-loop: the AI has doubts — answer before placing rooms.
        setQuestions(data.needsClarification);
        setDraftReasoning(data.draftReasoning || '');
        setAnswers(Object.fromEntries(data.needsClarification.map((q) => [q.id, q.options[0] || ''])));
        setPhase('clarify');
      } else if (status === 428) {
        // Server has no AI key configured — ops issue, never ask the user.
        setErrorMsg('AI is not configured on the server. Please try again later.');
        setPhase('error');
      } else {
        setErrorMsg(data.message || 'The AI planner could not complete this request.');
        setPhase('error');
      }
    } catch (e) {
      if (e instanceof RequestCancelled || ctrl.signal.aborted) {
        // User cancelled or the 4-minute client budget ran out: show the
        // error state (Retry + offline fallback) instead of hanging forever
        // or silently substituting non-AI designs.
        setErrorMsg(
          'The AI took too long (or was cancelled). The model is slow right now — retry, or continue without AI.',
        );
        setPhase('error');
        return;
      }
      // Last-resort client fallback so the screen never dead-ends.
      try {
        const ds = generateDesignOptions(config);
        setLocalDesigns(ds);
        setDesigns(ds);
        setAiPlanned(false);
        setPhase('ready');
      } catch {
        setErrorMsg('Could not generate designs. Check your connection and retry.');
        setPhase('error');
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  function cancelFetch() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (initialDesigns.length > 0) return; // state already initialized above
    if (fetched.current) return;
    fetched.current = true;
    // ?offline=1 forces the deterministic geometric engine (fast, no AI —
    // used by E2E and as a shareable fast path).
    const offline =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('offline') === '1';
    attemptsRef.current = 0; // fresh flow starts at base budget
    fetchDesigns(undefined, offline);
  }, []);

  // Animate the planning stages while loading.
  useEffect(() => {
    if (phase !== 'loading') return;
    if (stage >= PLAN_STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [phase, stage]);

  // Elapsed-seconds ticker so a slow model never looks frozen.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  function fmtElapsed(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function openDesign(d: ScoredLayout) {
    enterWorkspace(d);
  }

  function toggleCompare(d: ScoredLayout) {
    if (compare.find((x) => x.id === d.id)) {
      setCompare(compare.filter((x) => x.id !== d.id));
    } else if (compare.length < 2) {
      setCompare([...compare, d]);
    }
  }

  const best = designs.length > 0 ? [...designs].sort((a, b) => b.score.total - a.score.total)[0] : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView({ name: 'wizard' })}><ArrowLeft className="size-4" /></Button>
            <Brand size={26} />
          </div>
          <div className="text-center hidden sm:block">
            <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Your Blueprint Options Are Ready</p>
            <p className="text-xs text-muted-foreground tech-num">{config.plot.width}×{config.plot.length} {config.plot.unit} · {config.floors} floor(s)</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={compare.length !== 2}
            onClick={() => setShowCompare(true)}
            className="gap-1.5"
          >
            <GitCompareArrows className="size-4" /> Compare ({compare.length}/2)
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Choose a design concept</h1>
          <p className="text-sm text-muted-foreground">
            Five AI-reasoned preliminary layouts, each optimized for a different goal. Select one to open in the workspace, or compare two side-by-side.
          </p>
        </motion.div>

        {phase === 'loading' && (
          <div>
            <Card className="p-5 mb-6 bp-grid-dark text-white">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-cyan tech-num">AI thinking… {fmtElapsed(elapsed)}</span>
                <Button variant="ghost" size="sm" onClick={cancelFetch} className="text-white/70 hover:text-white h-7 text-xs">
                  Cancel
                </Button>
              </div>
              <div className="space-y-2.5 font-mono text-sm">
                {PLAN_STAGES.map((s, i) => (
                  <div key={i} className={cn('flex items-center gap-2', i > stage && 'opacity-40')}>
                    {i < stage ? <CheckCircle2 className="size-4 text-cyan" />
                      : i === stage ? <Loader2 className="size-4 text-cyan animate-spin" />
                      : <div className="size-4 rounded-full border border-white/30" />}
                    <span className={i <= stage ? 'text-white' : 'text-white/60'}>{s}</span>
                  </div>
                ))}
              </div>
              {elapsed > 60 && (
                <p className="font-mono text-[11px] text-white/50 mt-3">
                  Taking longer than usual — the model is under load. You can wait, cancel, or use the offline fallback if an error appears.
                </p>
              )}
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-48 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {phase === 'clarify' && (
          <div className="max-w-2xl mx-auto">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                <Sparkles className="size-5 text-cyan" /> The AI needs your call
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                Your inputs conflict in a way the AI should not guess about. Answer {questions.length} question{questions.length > 1 ? 's' : ''} and it will plan accordingly.
              </p>
              {draftReasoning && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-cyan/40 pl-3 mb-5">{draftReasoning}</p>
              )}
              <div className="space-y-5">
                {questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <Button
                          key={opt}
                          size="sm"
                          variant={answers[q.id] === opt ? 'default' : 'outline'}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        >
                          {opt}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-6">
                <Button onClick={() => fetchDesigns(answers)} className="gap-1.5">
                  <Sparkles className="size-4" /> Plan with my answers
                </Button>
                <Button variant="ghost" onClick={() => setView({ name: 'wizard' })}>Back to wizard</Button>
              </div>
            </Card>
          </div>
        )}

        {phase === 'error' && (
          <div className="max-w-xl mx-auto text-center">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-1">AI planner hit a snag</h2>
              <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => fetchDesigns()} className="gap-1.5"><RotateCcw className="size-4" /> Retry</Button>
                <Button variant="outline" onClick={() => fetchDesigns(undefined, true)}>Continue without AI (geometric only)</Button>
              </div>
            </Card>
          </div>
        )}

        {phase === 'ready' && (
          <div>
            {(reasoning || aiPlanned) && (
              <Card className="p-5 mb-6 border-cyan/30 bg-cyan/5">
                <div className="flex items-start gap-3">
                  <Sparkles className="size-5 text-cyan shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold">How the AI reasoned this plan</h3>
                      {aiPlanned
                        ? <Badge className="text-[10px] bg-cyan text-white hover:bg-cyan">AI-reasoned</Badge>
                        : <Badge variant="outline" className="text-[10px]">Geometric fallback (no AI)</Badge>}
                    </div>
                    {reasoning && <p className="text-xs text-muted-foreground leading-relaxed">{reasoning}</p>}
                    {assumptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {assumptions.map((a, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] font-normal">Assumes: {a}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {designs.map((d, i) => (
                <DesignCard
                  key={d.id}
                  design={d}
                  index={i}
                  isBest={best?.id === d.id}
                  selected={!!compare.find((x) => x.id === d.id)}
                  onOpen={() => openDesign(d)}
                  onCompare={() => toggleCompare(d)}
                />
              ))}
            </div>
            <Card className="mt-8 p-5 bg-amber-soft/10 border-amber-soft/40">
              <div className="flex items-start gap-3">
                <Sparkles className="size-5 text-amber-soft shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold mb-1">Preliminary conceptual designs</h3>
                  <p className="text-xs text-muted-foreground">
                    These layouts are AI-reasoned preliminary concepts generated from your plot, rooms, preferences, and Vastu inputs. They are not structural, regulatory, or engineering drawings. Open any design in the workspace to edit, visualize in 3D, estimate cost, and export.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      <CompareDialog open={showCompare} onOpenChange={setShowCompare} designs={compare} config={config} onOpenDesign={openDesign} />
    </div>
  );
}

function DesignCard({
  design,
  index,
  isBest,
  selected,
  onOpen,
  onCompare,
}: {
  design: ScoredLayout;
  index: number;
  isBest: boolean;
  selected: boolean;
  onOpen: () => void;
  onCompare: () => void;
}) {
  const bars = scoreBreakdownBars(design.score);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className={cn('overflow-hidden h-full flex flex-col', isBest && 'ring-2 ring-cyan', selected && 'ring-2 ring-primary')}>
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>{design.name}</h3>
              {isBest && (
                <Badge className="gap-1 bg-cyan text-white hover:bg-cyan"><Trophy className="size-3" /> Best</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{design.tagline}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tech-num text-primary" style={{ fontFamily: 'var(--font-display)' }}>{design.score.total}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">/ 100</div>
          </div>
        </div>

        <div className="p-4 bp-grid bg-muted/20">
          <div className="aspect-[4/3] flex items-center justify-center">
            <MiniPlan layout={design.layout} className="w-full h-full max-h-56" />
          </div>
        </div>

        <div className="p-4 border-t border-border/60 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Built Area</p>
              <p className="text-sm font-semibold tech-num">{design.builtUpArea.toLocaleString()}<span className="text-[10px] text-muted-foreground ml-0.5">sq.ft</span></p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Rooms</p>
              <p className="text-sm font-semibold tech-num">{design.roomCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Floors</p>
              <p className="text-sm font-semibold tech-num">{design.layout.floors}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-28 shrink-0">{b.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: b.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${b.value}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + index * 0.05 }}
                  />
                </div>
                <span className="text-[10px] font-semibold tech-num w-8 text-right">{b.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 pt-0 flex gap-2 mt-auto">
          <Button onClick={onOpen} className="flex-1 gap-1.5">
            Open Design <ArrowRight className="size-4" />
          </Button>
          <Button variant={selected ? 'default' : 'outline'} size="icon" onClick={onCompare} title="Compare">
            <GitCompareArrows className="size-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function CompareDialog({
  open,
  onOpenChange,
  designs,
  config,
  onOpenDesign,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  designs: ScoredLayout[];
  config: ProjectConfig;
  onOpenDesign: (d: ScoredLayout) => void;
}) {
  if (designs.length !== 2) return null;
  const [a, b] = designs;
  const rows: { label: string; a: string | number; b: string | number; better?: 'a' | 'b' }[] = [
    { label: 'Built Area', a: `${a.builtUpArea} sq.ft`, b: `${b.builtUpArea} sq.ft`, better: a.builtUpArea >= b.builtUpArea ? 'a' : 'b' },
    { label: 'Rooms', a: a.roomCount, b: b.roomCount, better: a.roomCount >= b.roomCount ? 'a' : 'b' },
    { label: 'Design Score', a: a.score.total, b: b.score.total, better: a.score.total >= b.score.total ? 'a' : 'b' },
    { label: 'Space Utilization', a: `${a.score.spaceUtilization}%`, b: `${b.score.spaceUtilization}%`, better: a.score.spaceUtilization >= b.score.spaceUtilization ? 'a' : 'b' },
    { label: 'Circulation', a: `${a.score.circulation}%`, b: `${b.score.circulation}%`, better: a.score.circulation >= b.score.circulation ? 'a' : 'b' },
    { label: 'Ventilation', a: `${a.score.ventilation}%`, b: `${b.score.ventilation}%`, better: a.score.ventilation >= b.score.ventilation ? 'a' : 'b' },
    { label: 'Requirement Match', a: `${a.score.requirementMatch}%`, b: `${b.score.requirementMatch}%`, better: a.score.requirementMatch >= b.score.requirementMatch ? 'a' : 'b' },
    { label: 'Parking', a: a.layout.rooms.some((r) => r.type === 'parking') ? '✓' : '—', b: b.layout.rooms.some((r) => r.type === 'parking') ? '✓' : '—' },
    { label: 'Strategy', a: a.tagline, b: b.tagline },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitCompareArrows className="size-5 text-cyan" /> Design Comparison</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[a, b].map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{d.name}</h3>
                <Badge variant="secondary">{d.tagline}</Badge>
              </div>
              <div className="aspect-[4/3] bp-grid bg-muted/20 rounded-md p-2">
                <MiniPlan layout={d.layout} className="w-full h-full" />
              </div>
              <Button className="w-full mt-2 gap-1.5" onClick={() => onOpenDesign(d)}>
                Open {d.name} <ArrowRight className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="border border-border rounded-md overflow-hidden">
          <div className="grid grid-cols-3 bg-muted text-xs font-semibold">
            <div className="p-2.5">Metric</div>
            <div className="p-2.5 text-center">{a.name}</div>
            <div className="p-2.5 text-center">{b.name}</div>
          </div>
          {rows.map((r, i) => (
            <div key={r.label} className={cn('grid grid-cols-3 text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
              <div className="p-2.5 text-muted-foreground">{r.label}</div>
              <div className={cn('p-2.5 text-center tech-num font-medium', r.better === 'a' && 'text-cyan')}>{r.a}</div>
              <div className={cn('p-2.5 text-center tech-num font-medium', r.better === 'b' && 'text-cyan')}>{r.b}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
