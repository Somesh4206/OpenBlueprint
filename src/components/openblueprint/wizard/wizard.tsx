'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Brand } from '@/components/openblueprint/brand';
import { MiniPlan } from '@/components/openblueprint/mini-plan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Ruler,
  LayoutGrid,
  Settings2,
  Sparkles,
  Plus,
  Minus,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Compass,
  AlertTriangle,
  Home,
  CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_ROOM_TYPES, ROOM_CATALOG } from '@/lib/room-catalog';
import { RoomRequirement, RoomType, PreferenceKey, DesignStyle, ScoredLayout, ProjectConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 0, name: 'Plot Details', icon: Ruler },
  { id: 1, name: 'Room Requirements', icon: LayoutGrid },
  { id: 2, name: 'Preferences', icon: Settings2 },
  { id: 3, name: 'Generate', icon: Sparkles },
];

const PREFERENCES: { key: PreferenceKey; label: string; desc: string }[] = [
  { key: 'kitchen-near-dining', label: 'Kitchen next to dining', desc: 'AI joins them wall-to-wall for easy serving' },
  { key: 'master-attached-bath', label: 'Master bedroom + attached bath', desc: 'AI gives the master bedroom its own en-suite' },
  { key: 'balcony-bedroom', label: 'Balcony off a bedroom', desc: 'AI attaches the balcony to a bedroom, not the hall' },
  { key: 'open-plan', label: 'Open-plan living', desc: 'AI clusters living + dining + kitchen as one flowing space' },
  { key: 'max-natural-light', label: 'Maximum natural light', desc: 'AI pushes bedrooms & living to outer walls with windows' },
];

const STYLES: { value: DesignStyle; label: string; desc: string }[] = [
  { value: 'modern', label: 'Modern', desc: 'Clean lines, flat roof, open feel' },
  { value: 'minimal', label: 'Minimal', desc: 'Less is more — calm & compact' },
  { value: 'traditional', label: 'Traditional', desc: 'Warm pitched roof, classic charm' },
  { value: 'contemporary', label: 'Contemporary', desc: 'Bold overhangs, mixed materials' },
  { value: 'luxury', label: 'Luxury', desc: 'Grand volumes, premium finishes' },
];

export function Wizard() {
  const setView = useApp((s) => s.setView);
  const wizardConfig = useApp((s) => s.wizardConfig);
  const setWizardConfig = useApp((s) => s.setWizardConfig);
  const [step, setStep] = useState(0);
  const [showFloorDialog, setShowFloorDialog] = useState(false);

  function next() {
    if (step < 3) setStep(step + 1);
  }
  function back() {
    if (step > 0) setStep(step - 1);
    else setView({ name: 'landing' });
  }

  async function generate() {
    // For multi-floor buildings, show the floor distribution dialog first
    // (human-in-the-loop to avoid misconceptions about room placement)
    if (wizardConfig.floors > 1) {
      setShowFloorDialog(true);
    } else {
      doGenerate();
    }
  }

  function doGenerate(assignment?: Record<string, number[]>) {
    setShowFloorDialog(false);
    // IMPORTANT: build the config from the passed assignment directly.
    // The old code relied on setWizardConfig + setTimeout, but the closure
    // held the STALE config — floorAssignment never reached the API, so the
    // user's floor choices were silently ignored. This was the reported bug.
    if (assignment) setWizardConfig({ floorAssignment: assignment });
    const config = assignment ? { ...wizardConfig, floorAssignment: assignment } : wizardConfig;
    // The design-options screen performs the real AI-first fetch (with key,
    // clarification, and error states). Just navigate — it handles the rest.
    setView({
      name: 'design-options',
      config,
      designs: [],
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => setView({ name: 'landing' })}>
            <Brand size={28} />
          </button>
          <div className="hidden md:flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                    i === step ? 'bg-primary text-primary-foreground' : i < step ? 'text-primary hover:bg-muted' : 'text-muted-foreground/50'
                  )}
                >
                  <span className="tech-num font-semibold">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hidden lg:inline">{s.name}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="size-3 text-muted-foreground/40" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'landing' })}>Cancel</Button>
            {step < 3 ? (
              <Button size="sm" onClick={next} className="gap-1.5">
                Continue <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={generate} className="gap-1.5">
                <Sparkles className="size-3.5" /> Generate
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${((step + 1) / 4) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {step === 0 && <PlotStep key="plot" config={wizardConfig} setConfig={setWizardConfig} />}
          {step === 1 && <RoomsStep key="rooms" config={wizardConfig} setConfig={setWizardConfig} />}
          {step === 2 && <PreferencesStep key="prefs" config={wizardConfig} setConfig={setWizardConfig} />}
          {step === 3 && <GenerateStep key="gen" config={wizardConfig} onGenerate={generate} />}
        </AnimatePresence>
      </main>

      {/* Footer nav — sticky so Continue is always one click away */}
      <footer className="sticky bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button variant="ghost" onClick={back} className="gap-1.5">
            <ArrowLeft className="size-4" /> {step === 0 ? 'Home' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button onClick={next} className="gap-1.5">
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={generate} className="gap-1.5">
              <Sparkles className="size-4" /> Generate Blueprints
            </Button>
          )}
        </div>
      </footer>

      {/* Human-in-the-loop floor distribution dialog */}
      {showFloorDialog && (
        <FloorDistributionDialog
          config={wizardConfig}
          onConfirm={(floorAssignment) => doGenerate(floorAssignment)}
          onCancel={() => setShowFloorDialog(false)}
        />
      )}
    </div>
  );
}

const PLOT_PRESETS = [
  { label: '20 × 30', w: 20, l: 30, hint: 'Compact' },
  { label: '30 × 40', w: 30, l: 40, hint: 'Classic' },
  { label: '30 × 50', w: 30, l: 50, hint: 'Popular' },
  { label: '40 × 60', w: 40, l: 60, hint: 'Spacious' },
];

// ---------------- STEP 1: Plot Details ----------------
function PlotStep({ config, setConfig }: { config: ProjectConfig; setConfig: (c: Partial<ProjectConfig>) => void }) {
  const { plot, floors } = config;
  const plotArea = plot.width * plot.length;
  const buildableW = Math.max(0, plot.width - plot.setbackSides * 2);
  const buildableL = Math.max(0, plot.length - plot.setbackFront - plot.setbackRear);
  const buildablePct = plotArea > 0 ? Math.round((buildableW * buildableL / plotArea) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid lg:grid-cols-2 gap-8">
      <div>
        <Badge variant="secondary" className="mb-2 tech-num text-[10px]">STEP 01 / 04</Badge>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Your land, exactly as it is</h2>
        <p className="text-muted-foreground mb-5 text-sm">Enter the plot size from your sale deed or site measurement. The AI plans only inside the buildable area — everything updates live on the right.</p>

        {/* Common sizes */}
        <Label className="text-xs text-muted-foreground">Common plot sizes — tap to fill</Label>
        <div className="grid grid-cols-4 gap-2 mt-1.5 mb-5">
          {PLOT_PRESETS.map((p) => {
            const active = plot.width === p.w && plot.length === p.l;
            return (
              <button
                key={p.label}
                onClick={() => setConfig({ plot: { ...plot, width: p.w, length: p.l } })}
                className={cn(
                  'rounded-lg border px-2 py-2 text-center transition-all hover:-translate-y-0.5',
                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-cyan/50'
                )}
              >
                <p className="text-sm font-semibold tech-num">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Plot Width <span className="opacity-60">({plot.unit})</span></Label>
            <div className="relative mt-1">
              <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={10}
                value={plot.width}
                onChange={(e) => setConfig({ plot: { ...plot, width: Math.max(0, Number(e.target.value)) } })}
                className="tech-num pl-8 pr-10 h-10 text-base font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{plot.unit}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Plot Length <span className="opacity-60">({plot.unit})</span></Label>
            <div className="relative mt-1">
              <Ruler className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={10}
                value={plot.length}
                onChange={(e) => setConfig({ plot: { ...plot, length: Math.max(0, Number(e.target.value)) } })}
                className="tech-num pl-8 pr-10 h-10 text-base font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{plot.unit}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">How many floors?</Label>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5 p-1 rounded-lg bg-muted/60">
              {[1, 2, 3].map((f) => (
                <button
                  key={f}
                  onClick={() => setConfig({ floors: f })}
                  className={cn(
                    'rounded-md py-1.5 text-sm font-semibold tech-num transition-all',
                    floors === f ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f === 1 ? 'Single' : f === 2 ? 'Duplex' : 'Triplex'}
                  <span className="block text-[10px] font-normal opacity-70">{f} floor{f > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Measurement Unit</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5 p-1 rounded-lg bg-muted/60">
              {(['ft', 'm'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setConfig({ plot: { ...plot, unit: u } })}
                  className={cn(
                    'rounded-md py-2.5 text-sm font-semibold tech-num transition-all',
                    plot.unit === u ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {u === 'ft' ? 'Feet' : 'Meters'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Which side is the road on?</Label>
            <p className="text-[11px] text-muted-foreground mb-1.5">Entry, parking & living face this side.</p>
            <div className="grid grid-cols-3 gap-1 w-fit">
              <div />
              <RoadBtn side="north" current={plot.roadSide} set={(s) => setConfig({ plot: { ...plot, roadSide: s } })} label="N" />
              <div />
              <RoadBtn side="west" current={plot.roadSide} set={(s) => setConfig({ plot: { ...plot, roadSide: s } })} label="W" />
              <div className="size-9 rounded-md bg-muted/60 flex items-center justify-center"><Compass className="size-4 text-cyan" /></div>
              <RoadBtn side="east" current={plot.roadSide} set={(s) => setConfig({ plot: { ...plot, roadSide: s } })} label="E" />
              <div />
              <RoadBtn side="south" current={plot.roadSide} set={(s) => setConfig({ plot: { ...plot, roadSide: s } })} label="S" />
              <div />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">North Direction</Label>
            <p className="text-[11px] text-muted-foreground mb-1.5">For sunlight & Vastu orientation.</p>
            <Select value={String(plot.northDirection)} onValueChange={(v) => setConfig({ plot: { ...plot, northDirection: Number(v) } })}>
              <SelectTrigger className="tech-num mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Up (0°)</SelectItem>
                <SelectItem value="90">Right (90°)</SelectItem>
                <SelectItem value="180">Down (180°)</SelectItem>
                <SelectItem value="270">Left (270°)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Open margins around the house <span className="text-muted-foreground">({plot.unit})</span></Label>
            <Badge variant="secondary" className="tech-num text-[10px]">{buildablePct}% buildable</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2.5">Mandatory open space for light, ventilation & bylaws. The dashed area in the preview.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { k: 'setbackFront', label: 'Front (road side)' },
              { k: 'setbackRear', label: 'Rear' },
              { k: 'setbackSides', label: 'Each side' },
            ] as const).map((s) => (
              <div key={s.k}>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
                <Input
                  type="number"
                  min={0}
                  value={plot[s.k]}
                  onChange={(e) => setConfig({ plot: { ...plot, [s.k]: Math.max(0, Number(e.target.value)) } })}
                  className="tech-num h-9 mt-0.5"
                />
              </div>
            ))}
          </div>
          {buildablePct <= 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" /> Margins eat the full plot — reduce them to leave buildable area.
            </p>
          )}
        </div>
      </div>

      {/* Live plot preview */}
      <div>
        <Card className="p-4 sticky top-24">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Compass className="size-4 text-cyan" /> Live Plot Preview</h3>
            <Badge variant="secondary" className="tech-num">{plot.width} × {plot.length} {plot.unit}</Badge>
          </div>
          <div className="aspect-[3/4] bp-grid bg-card rounded-lg p-4 flex items-center justify-center relative overflow-hidden">
            <PlotPreview config={config} />
            <div className="absolute top-2 left-2 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded tech-num">
              Area: {(plot.width * plot.length).toLocaleString()} sq.{plot.unit}
            </div>
            <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
              <Home className="size-2.5" /> Road: {plot.roadSide}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="p-2 rounded bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Plot Area</p>
              <p className="text-sm font-semibold tech-num">{(plot.width * plot.length).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Floors</p>
              <p className="text-sm font-semibold tech-num">{floors}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-[10px] text-muted-foreground">Buildable</p>
              <p className="text-sm font-semibold tech-num">
                {((plot.width - plot.setbackSides * 2) * (plot.length - plot.setbackFront - plot.setbackRear)).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function RoadBtn({ side, current, set, label }: {
  side: 'north' | 'south' | 'east' | 'west';
  current: string;
  set: (s: 'north' | 'south' | 'east' | 'west') => void;
  label: string;
}) {
  const active = current === side;
  return (
    <button
      onClick={() => set(side)}
      title={`Road on ${side}`}
      className={cn(
        'size-9 rounded-md text-xs font-bold tech-num transition-all border',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow'
          : 'bg-background border-border text-muted-foreground hover:border-cyan/50 hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

function PlotPreview({ config }: { config: ProjectConfig }) {
  const { plot } = config;
  const maxDim = 280;
  const scale = maxDim / Math.max(plot.width, plot.length);
  const W = plot.width * scale;
  const H = plot.length * scale;
  const buildable = {
    x: plot.setbackSides * scale,
    y: plot.setbackRear * scale,
    w: W - plot.setbackSides * 2 * scale,
    h: H - (plot.setbackFront + plot.setbackRear) * scale,
  };
  return (
    <svg viewBox={`0 0 ${W + 20} ${H + 20}`} className="w-full h-full">
      <g transform="translate(10,10)">
        {/* plot boundary */}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="#2b4a7a" strokeWidth={2} />
        {/* buildable area */}
        {buildable.w > 0 && buildable.h > 0 && (
          <rect x={buildable.x} y={buildable.y} width={buildable.w} height={buildable.h} fill="#2b4a7a" fillOpacity={0.06} stroke="#2b6fe0" strokeWidth={1} strokeDasharray="4 3" />
        )}
        {/* road indicator */}
        <RoadIndicator plot={plot} W={W} H={H} />
        {/* dimensions */}
        <text x={W / 2} y={-4} textAnchor="middle" fontSize={9} fill="#5b6678" className="tech-num">{plot.width} {plot.unit}</text>
        <text x={-4} y={H / 2} textAnchor="middle" fontSize={9} fill="#5b6678" transform={`rotate(-90 ${-4} ${H / 2})`} className="tech-num">{plot.length} {plot.unit}</text>
        {/* north arrow */}
        <g transform={`translate(${W - 16}, 4)`}>
          <circle cx={0} cy={0} r={8} fill="white" stroke="#2b4a7a" strokeWidth={1} />
          <path d="M 0 -6 L -3 4 L 0 2 L 3 4 Z" fill="#2b6fe0" />
          <text x={0} y={12} textAnchor="middle" fontSize={6} fontWeight={700} fill="#2b4a7a">N</text>
        </g>
      </g>
    </svg>
  );
}

function RoadIndicator({ plot, W, H }: { plot: ProjectConfig['plot']; W: number; H: number }) {
  const color = '#2b6fe0';
  switch (plot.roadSide) {
    case 'south':
      return <rect x={0} y={H} width={W} height={5} fill={color} fillOpacity={0.3} />;
    case 'north':
      return <rect x={0} y={-5} width={W} height={5} fill={color} fillOpacity={0.3} />;
    case 'east':
      return <rect x={W} y={0} width={5} height={H} fill={color} fillOpacity={0.3} />;
    case 'west':
      return <rect x={-5} y={0} width={5} height={H} fill={color} fillOpacity={0.3} />;
  }
}

// ---------------- STEP 2: Room Requirements ----------------
function RoomsStep({ config, setConfig }: { config: ProjectConfig; setConfig: (c: Partial<ProjectConfig>) => void }) {
  const rooms = config.rooms;

  function updateRoom(type: RoomType, patch: Partial<RoomRequirement>) {
    setConfig({
      rooms: rooms.map((r) => (r.type === type ? { ...r, ...patch } : r)),
    });
  }
  function addRoom(type: RoomType) {
    const cat = ROOM_CATALOG[type];
    const existing = rooms.find((r) => r.type === type);
    if (existing) {
      updateRoom(type, { count: existing.count + 1 });
    } else {
      setConfig({
        rooms: [
          ...rooms,
          {
            type,
            name: cat.defaultName,
            count: 1,
            minWidth: cat.minWidth,
            minLength: cat.minLength,
            preferredWidth: cat.preferredWidth,
            preferredLength: cat.preferredLength,
            priority: 'medium',
            attachedTo: null,
            preferredLocation: null,
          },
        ],
      });
    }
  }
  function removeRoom(type: RoomType) {
    const existing = rooms.find((r) => r.type === type);
    if (!existing) return;
    if (existing.count > 1) {
      updateRoom(type, { count: existing.count - 1 });
    } else {
      setConfig({ rooms: rooms.filter((r) => r.type !== type) });
    }
  }

  function applyPreset(preset: RoomType[]) {
    const counts = new Map<RoomType, number>();
    for (const t of preset) counts.set(t, (counts.get(t) || 0) + 1);
    const next: RoomRequirement[] = [];
    for (const [type, count] of counts) {
      const cat = ROOM_CATALOG[type];
      const prev = rooms.find((r) => r.type === type);
      next.push({
        type,
        name: cat.defaultName,
        count,
        minWidth: prev?.minWidth ?? cat.minWidth,
        minLength: prev?.minLength ?? cat.minLength,
        preferredWidth: prev?.preferredWidth ?? cat.preferredWidth,
        preferredLength: prev?.preferredLength ?? cat.preferredLength,
        priority: prev?.priority ?? 'medium',
        attachedTo: null,
        preferredLocation: prev?.preferredLocation ?? null,
      });
    }
    setConfig({ rooms: next });
  }

  const BHK_PRESETS: { label: string; hint: string; rooms: RoomType[] }[] = [
    { label: '1 BHK', hint: 'Compact', rooms: ['bedroom', 'bathroom', 'kitchen', 'living'] },
    { label: '2 BHK', hint: 'Family', rooms: ['bedroom', 'bedroom', 'bathroom', 'bathroom', 'kitchen', 'living', 'dining', 'balcony'] },
    { label: '3 BHK', hint: 'Popular', rooms: ['bedroom', 'bedroom', 'bedroom', 'bathroom', 'bathroom', 'kitchen', 'living', 'dining', 'parking', 'balcony', 'pooja'] },
    { label: '4 BHK', hint: 'Large', rooms: ['bedroom', 'bedroom', 'bedroom', 'bedroom', 'bathroom', 'bathroom', 'bathroom', 'kitchen', 'living', 'dining', 'parking', 'balcony', 'pooja', 'office'] },
  ];

  const grouped = {
    private: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'private'),
    public: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'public'),
    service: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'service'),
    circulation: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'circulation'),
  };
  const groupLabels = {
    private: 'Private — quiet rear of the house',
    public: 'Public — welcoming front near the road',
    service: 'Service — utility edge, away from bedrooms',
    circulation: 'Circulation — movement & entry',
  };
  const totalRooms = rooms.reduce((s, r) => s + r.count, 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Badge variant="secondary" className="mb-2 tech-num text-[10px]">STEP 02 / 04</Badge>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>What should your home hold?</h2>
      <p className="text-muted-foreground mb-5 text-sm">Start from a preset or build your own — every room you pick is placed by the AI, with correct sizes and adjacencies.</p>

      {/* BHK presets */}
      <Label className="text-xs text-muted-foreground">Start from a home type — tap to fill</Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5 mb-6">
        {BHK_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.rooms)}
            className="rounded-lg border border-border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan/50 hover:shadow-sm"
          >
            <p className="text-sm font-bold">{p.label}</p>
            <p className="text-[11px] text-muted-foreground">{p.hint} · {p.rooms.length} spaces</p>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Room picker */}
        <div className="lg:col-span-2 space-y-5">
          {(Object.keys(grouped) as (keyof typeof grouped)[]).map((g) => (
            <div key={g}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{groupLabels[g]}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {grouped[g].map((type) => {
                  const cat = ROOM_CATALOG[type];
                  const req = rooms.find((r) => r.type === type);
                  const count = req?.count || 0;
                  return (
                    <Card
                      key={type}
                      className={cn(
                        'p-3 transition-all cursor-pointer hover:-translate-y-0.5',
                        count > 0 ? 'border-primary ring-1 ring-primary/25 bg-primary/[0.03]' : 'hover:border-cyan/40 hover:shadow-sm'
                      )}
                      onClick={() => count === 0 && addRoom(type)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                          <span className="size-2 rounded-full shrink-0" style={{ background: cat.accent }} />
                          <span className="truncate">{cat.label}</span>
                        </span>
                        {count > 0 ? (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => removeRoom(type)}><Minus className="size-3" /></Button>
                            <span className="tech-num text-sm font-bold w-5 text-center text-primary">{count}</span>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => addRoom(type)}><Plus className="size-3" /></Button>
                          </div>
                        ) : (
                          <Plus className="size-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 tech-num">ideal {cat.preferredWidth}×{cat.preferredLength} {config.plot.unit}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected rooms detail */}
        <Card className="p-4 lg:sticky lg:top-24 flex flex-col border-cyan/20" style={{ maxHeight: '70vh' }}>
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><LayoutGrid className="size-4 text-cyan" /> Your list ({totalRooms})</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Fine-tune sizes & priorities — the AI honours these.</p>
          <div className="flex-1 overflow-y-auto scroll-thin -mx-2 px-2 min-h-0">
            {rooms.length === 0 ? (
              <div className="py-8 text-center">
                <LayoutGrid className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">Nothing here yet</p>
                <p className="text-xs text-muted-foreground mt-1">Pick a home type above,<br />or tap any room card to add it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((r) => {
                  const cat = ROOM_CATALOG[r.type];
                  return (
                    <div key={r.type + "-" + r.name} className="p-3 rounded-md border border-border/70 bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{r.name} <span className="text-muted-foreground tech-num">×{r.count}</span></span>
                        <Badge variant="outline" className="text-[10px]" style={{ color: cat.accent, borderColor: cat.accent }}>{cat.group}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <span className="text-[9px] text-muted-foreground">Preferred W×L</span>
                          <div className="flex gap-1">
                            <Input type="number" value={r.preferredWidth} onChange={(e) => updateRoom(r.type, { preferredWidth: Number(e.target.value) })} className="tech-num h-7 text-xs" />
                            <Input type="number" value={r.preferredLength} onChange={(e) => updateRoom(r.type, { preferredLength: Number(e.target.value) })} className="tech-num h-7 text-xs" />
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground">Priority</span>
                          <Select value={r.priority} onValueChange={(v) => updateRoom(r.type, { priority: v as 'high' | 'medium' | 'low' })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground">Preferred Location</span>
                        <Select value={r.preferredLocation || 'none'} onValueChange={(v) => updateRoom(r.type, { preferredLocation: v === 'none' ? null : (v as 'front' | 'rear' | 'side' | 'center') })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Any</SelectItem>
                            <SelectItem value="front">Front</SelectItem>
                            <SelectItem value="rear">Rear</SelectItem>
                            <SelectItem value="side">Side</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// ---------------- STEP 3: Preferences ----------------
function PreferencesStep({ config, setConfig }: { config: ProjectConfig; setConfig: (c: Partial<ProjectConfig>) => void }) {
  const togglePref = (key: PreferenceKey) => {
    const has = config.preferences.includes(key);
    setConfig({ preferences: has ? config.preferences.filter((p) => p !== key) : [...config.preferences, key] });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid lg:grid-cols-2 gap-8">
      <div>
        <Badge variant="secondary" className="mb-2 tech-num text-[10px]">STEP 03 / 04</Badge>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>How should it feel?</h2>
        <p className="text-muted-foreground mb-6 text-sm">Pick a look, then tell the AI what matters to you. Each switch below becomes a hard instruction in the AI&apos;s plan — not a hint.</p>

        {/* Style */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Look & feel <span className="normal-case font-normal opacity-70">— sets the 3D style too</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {STYLES.map((s) => {
            const selected = config.style === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setConfig({ style: s.value })}
                className={cn(
                  'text-left p-3 rounded-lg border transition-all hover:-translate-y-0.5 flex items-start justify-between gap-2',
                  selected ? 'border-primary ring-1 ring-primary/25 bg-primary/[0.04] shadow-sm' : 'border-border hover:border-cyan/40'
                )}
              >
                <span>
                  <span className="text-sm font-semibold">{s.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </span>
                <span className={cn(
                  'size-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                  selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent'
                )}>
                  <Check className="size-3" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Preferences */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What matters to you</h3>
          <Badge variant="secondary" className="tech-num text-[10px]">
            {config.preferences.length} on
          </Badge>
        </div>
        <div className="space-y-2">
          {PREFERENCES.map((p) => {
            const active = config.preferences.includes(p.key);
            return (
              <div
                key={p.key}
                role="button"
                tabIndex={0}
                onClick={() => togglePref(p.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePref(p.key);
                  }
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer hover:-translate-y-px',
                  active ? 'border-primary/40 bg-primary/[0.04] shadow-sm' : 'border-border hover:border-cyan/40'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn(
                    'size-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                    active ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-transparent'
                  )}>
                    <Check className="size-3" />
                  </span>
                  <span>
                    <p className="text-sm font-medium leading-tight">{p.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </span>
                </div>
                <Switch checked={active} onCheckedChange={() => togglePref(p.key)} onClick={(e) => e.stopPropagation()} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Vastu */}
      <div>
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold flex items-center gap-2"><Compass className="size-4 text-cyan" /> Vastu <Badge variant="outline" className="text-[10px] font-normal">optional</Badge></h3>
            <Switch checked={config.vastuEnabled} onCheckedChange={(b) => setConfig({ vastuEnabled: b })} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Traditional directional guidance for entrance, kitchen, bedroom & pooja. The AI follows it without breaking structural rules — safety and building codes always come first.
          </p>
          <div className={cn('space-y-3 transition-opacity', !config.vastuEnabled && 'opacity-40 pointer-events-none')}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground">Entrance</span>
                <Select value={config.vastu.entrance || 'none'} onValueChange={(v) => setConfig({ vastu: { ...config.vastu, entrance: v === 'none' ? null : (v as 'north' | 'east' | 'south' | 'west') } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="north">North</SelectItem>
                    <SelectItem value="east">East</SelectItem>
                    <SelectItem value="south">South</SelectItem>
                    <SelectItem value="west">West</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Kitchen</span>
                <Select value={config.vastu.kitchen || 'none'} onValueChange={(v) => setConfig({ vastu: { ...config.vastu, kitchen: v === 'none' ? null : (v as 'southeast' | 'northwest') } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="southeast">Southeast</SelectItem>
                    <SelectItem value="northwest">Northwest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Bedroom</span>
                <Select value={config.vastu.bedroom || 'none'} onValueChange={(v) => setConfig({ vastu: { ...config.vastu, bedroom: v === 'none' ? null : (v as 'southwest' | 'south') } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="southwest">Southwest</SelectItem>
                    <SelectItem value="south">South</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Pooja Room</span>
                <Select value={config.vastu.pooja || 'none'} onValueChange={(v) => setConfig({ vastu: { ...config.vastu, pooja: v === 'none' ? null : (v as 'northeast' | 'center-east') } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="northeast">Northeast</SelectItem>
                    <SelectItem value="center-east">Center-East</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-amber-soft/10 border-amber-soft/40">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 text-amber-soft shrink-0" />
            <div>
              <h4 className="text-sm font-semibold mb-1">What happens next?</h4>
              <p className="text-xs text-muted-foreground">
                The AI reasons over everything above — plot, rooms, switches, Vastu — then draws 5 plan options. If anything conflicts, it asks you first. Plans are preliminary concepts: get a licensed architect&apos;s sign-off before building.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// ---------------- STEP 4: Generate ----------------
// NOTE: this step is review + a single button. The REAL AI run happens once,
// on the design-options screen (with live progress, doubts and errors).
// The old fake planning animation here made it look like the AI ran twice.
function GenerateStep({ config, onGenerate }: { config: ProjectConfig; onGenerate: () => void }) {
  const totalRooms = config.rooms.reduce((s, r) => s + r.count, 0);
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto">
      <Badge variant="secondary" className="mb-2 tech-num text-[10px] mx-auto flex w-fit">STEP 04 / 04</Badge>
      <h2 className="text-2xl font-bold mb-1 text-center" style={{ fontFamily: 'var(--font-display)' }}>Ready when you are</h2>
      <p className="text-muted-foreground mb-8 text-sm text-center">
        Review everything below. One click sends it all to the AI — it reasons about zoning, adjacency and doors, draws 5 plan options, and asks you first if anything conflicts.
        {config.floors > 1 && ' Since this is multi-floor, you’ll confirm the room-per-floor split first.'}
      </p>

      <Card className="p-6 mb-6">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCheck className="size-4 text-cyan" /> Configuration Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="Plot" value={`${config.plot.width} × ${config.plot.length} ${config.plot.unit}`} />
          <SummaryItem label="Floors" value={`${config.floors}`} />
          <SummaryItem label="Road Side" value={config.plot.roadSide} />
          <SummaryItem label="Style" value={config.style} />
          <SummaryItem label="Rooms" value={`${totalRooms}`} />
          <SummaryItem label="Preferences" value={`${config.preferences.length}`} />
          <SummaryItem label="Vastu" value={config.vastuEnabled ? 'Enabled' : 'Off'} />
          <SummaryItem label="Building Area" value={`${(config.plot.width - config.plot.setbackSides * 2) * (config.plot.length - config.plot.setbackFront - config.plot.setbackRear)} sq.${config.plot.unit}`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {config.rooms.map((r) => (
            <Badge key={r.type + "-" + r.name} variant="secondary" className="text-xs">{r.name} ×{r.count}</Badge>
          ))}
        </div>
      </Card>

      <div className="text-center">
        <Button size="lg" onClick={onGenerate} className="gap-2 w-full sm:w-auto">
          <Sparkles className="size-4" /> Generate My Blueprints
        </Button>
        <p className="text-xs text-muted-foreground mt-3">5 AI-reasoned variants — usually 10–30 seconds.</p>
      </div>
    </motion.div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/40">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize tech-num">{value}</span>
    </div>
  );
}

// ---------------- Floor Distribution Dialog (Human-in-the-loop) ----------------
function FloorDistributionDialog({
  config,
  onConfirm,
  onCancel,
}: {
  config: ProjectConfig;
  onConfirm: (floorAssignment: Record<string, number[]>) => void;
  onCancel: () => void;
}) {
  const floors = config.floors;
  const floorLabels = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'];

  // Build the default distribution (same logic as the engine:
  // dining ALWAYS stays with the kitchen on the ground — splitting them
  // across floors breaks the serving link, which is exactly what the AI
  // flagged live in testing).
  const groundTypes = new Set(['parking', 'living', 'dining', 'kitchen', 'foyer', 'store', 'staircase']);
  const hasParking = config.rooms.some((r) => r.type === 'parking');

  // State: floorAssignment maps room type → [count per floor]
  const [assignment, setAssignment] = useState<Record<string, number[]>>(() => {
    const init: Record<string, number[]> = {};
    for (const r of config.rooms) {
      const cat = ROOM_CATALOG[r.type];
      if (r.type === 'staircase' && floors > 1) {
        init[r.type] = Array(floors).fill(0).map((_, i) => i === 0 ? 1 : 1); // staircase on all floors
        continue;
      }
      if (r.type === 'parking') {
        init[r.type] = Array(floors).fill(0).map((_, i) => i === 0 ? r.count : 0);
        continue;
      }
      if (groundTypes.has(r.type)) {
        const arr = Array(floors).fill(0);
        arr[0] = r.count;
        init[r.type] = arr;
      } else {
        // distribute across upper floors
        const arr = Array(floors).fill(0);
        if (floors === 1) {
          arr[0] = r.count;
        } else {
          // bathrooms: 1 on ground only with a foyer to buffer it
          // (a bath opening into living/dining/kitchen violates hard rules)
          const hasFoyer = config.rooms.some((x) => x.type === 'foyer');
          if (r.type === 'bathroom' && !hasParking && hasFoyer && floors > 1) {
            arr[0] = 1;
            const rest = r.count - 1;
            for (let f = 1; f < floors && rest > 0; f++) {
              arr[f] = Math.ceil(rest / (floors - f));
            }
          } else {
            const rest = r.count;
            for (let f = 1; f < floors && rest > 0; f++) {
              arr[f] = Math.ceil(rest / (floors - f));
            }
          }
        }
        init[r.type] = arr;
      }
    }
    return init;
  });

  function moveUp(type: string, floor: number) {
    if (floor <= 0) return;
    setAssignment((prev) => {
      const arr = [...(prev[type] || [])];
      if (arr[floor] > 0) {
        arr[floor]--;
        arr[floor - 1]++;
      }
      return { ...prev, [type]: arr };
    });
  }
  function moveDown(type: string, floor: number) {
    if (floor >= floors - 1) return;
    setAssignment((prev) => {
      const arr = [...(prev[type] || [])];
      if (arr[floor] > 0) {
        arr[floor]--;
        arr[floor + 1]++;
      }
      return { ...prev, [type]: arr };
    });
  }

  // Group rooms by floor for display
  const floorRooms: { type: string; name: string; count: number }[][] = Array.from({ length: floors }, () => []);
  for (const r of config.rooms) {
    const arr = assignment[r.type] || [];
    for (let f = 0; f < floors; f++) {
      const count = arr[f] || 0;
      if (count > 0) {
        floorRooms[f].push({ type: r.type, name: ROOM_CATALOG[r.type]?.label || r.type, count });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Confirm Floor Distribution</h2>
          <p className="text-sm text-muted-foreground">
            Your building has <b>{floors} floor{floors > 1 ? 's' : ''}</b>. Review which rooms go on each floor and adjust if needed. This prevents layout misconceptions.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin p-5">
          <div className={`grid gap-4 ${floors === 2 ? 'grid-cols-2' : floors === 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {Array.from({ length: floors }, (_, f) => (
              <div key={f} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{floorLabels[f]}</h3>
                  <Badge variant="secondary" className="tech-num text-[10px]">{floorRooms[f].reduce((s, r) => s + r.count, 0)} rooms</Badge>
                </div>
                <div className="space-y-2">
                  {floorRooms[f].length === 0 && <p className="text-xs text-muted-foreground italic py-4 text-center">No rooms</p>}
                  {floorRooms[f].map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-background border border-border/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate">{r.name}</span>
                        {r.count > 1 && <Badge variant="outline" className="tech-num text-[9px] shrink-0">×{r.count}</Badge>}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => moveUp(r.type, f)} disabled={f === 0} className="size-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed">
                          <ChevronUp className="size-3" />
                        </button>
                        <button onClick={() => moveDown(r.type, f)} disabled={f === floors - 1} className="size-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed">
                          <ChevronDown className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-soft/10 border border-amber-soft/30">
            <p className="text-xs text-muted-foreground">
              <b>Tip:</b> Use the ↑/↓ arrows to move rooms between floors. Typical Indian layout: Ground floor = parking, living, kitchen, dining. Upper floors = bedrooms, bathrooms, pooja, balcony. Staircase connects all floors.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onConfirm(assignment)} className="gap-1.5">
              <Sparkles className="size-4" /> Confirm & Generate
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
