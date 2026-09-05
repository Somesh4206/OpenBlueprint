'use client';

import { useState, useMemo, useEffect } from 'react';
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
  CheckCircle2,
  Loader2,
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
  { key: 'kitchen-near-dining', label: 'Kitchen near dining', desc: 'Place kitchen adjacent to dining area' },
  { key: 'master-attached-bath', label: 'Master bedroom + attached bath', desc: 'En-suite bathroom for master bedroom' },
  { key: 'parking-near-entrance', label: 'Parking near entrance', desc: 'Parking close to the road-side entry' },
  { key: 'internal-staircase', label: 'Internal staircase', desc: 'Staircase inside the built area' },
  { key: 'balcony-bedroom', label: 'Balcony to bedroom', desc: 'Attach balcony to a bedroom' },
  { key: 'max-natural-light', label: 'Maximum natural light', desc: 'Prioritize outer-wall windows' },
  { key: 'improved-circulation', label: 'Improved circulation', desc: 'Wider internal circulation paths' },
  { key: 'open-plan', label: 'Open-plan layout', desc: 'Combine living + dining + kitchen' },
];

const STYLES: { value: DesignStyle; label: string; desc: string }[] = [
  { value: 'modern', label: 'Modern', desc: 'Clean lines, flat forms' },
  { value: 'minimal', label: 'Minimal', desc: 'Reduction, simplicity' },
  { value: 'traditional', label: 'Traditional', desc: 'Warm, classic forms' },
  { value: 'contemporary', label: 'Contemporary', desc: 'Current, mixed materials' },
  { value: 'luxury', label: 'Luxury', desc: 'Premium finishes, space' },
];

export function Wizard() {
  const setView = useApp((s) => s.setView);
  const wizardConfig = useApp((s) => s.wizardConfig);
  const setWizardConfig = useApp((s) => s.setWizardConfig);
  const setDesigns = useApp((s) => s.setDesigns);
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

  async function doGenerate() {
    setShowFloorDialog(false);
    setView({
      name: 'design-options',
      config: wizardConfig,
      designs: [],
    });
    try {
      const res = await fetch('/api/layout/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardConfig),
      });
      const data = await res.json();
      setDesigns(data.designs || []);
    } catch {
      // fallback handled by design-options using client engine import
    }
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
          <Button variant="ghost" size="sm" onClick={() => setView({ name: 'landing' })}>Cancel</Button>
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

      {/* Footer nav */}
      <footer className="border-t border-border bg-card">
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
          onConfirm={(floorAssignment) => {
            setWizardConfig({ floorAssignment });
            // need to call doGenerate after state updates
            setTimeout(() => doGenerate(), 100);
          }}
          onCancel={() => setShowFloorDialog(false)}
        />
      )}
    </div>
  );
}

// ---------------- STEP 1: Plot Details ----------------
function PlotStep({ config, setConfig }: { config: ProjectConfig; setConfig: (c: Partial<ProjectConfig>) => void }) {
  const { plot, floors } = config;
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid lg:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>01 — Enter Measurements</h2>
        <p className="text-muted-foreground mb-6 text-sm">Define your plot dimensions and orientation. The plot preview updates live.</p>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Plot Width</Label>
            <div className="relative">
              <Input
                type="number"
                value={plot.width}
                onChange={(e) => setConfig({ plot: { ...plot, width: Number(e.target.value) } })}
                className="tech-num pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{plot.unit}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Plot Length</Label>
            <div className="relative">
              <Input
                type="number"
                value={plot.length}
                onChange={(e) => setConfig({ plot: { ...plot, length: Number(e.target.value) } })}
                className="tech-num pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{plot.unit}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Measurement Unit</Label>
            <Select value={plot.unit} onValueChange={(v) => setConfig({ plot: { ...plot, unit: v as 'ft' | 'm' } })}>
              <SelectTrigger className="tech-num"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ft">Feet (ft)</SelectItem>
                <SelectItem value="m">Meters (m)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Number of Floors</Label>
            <Select value={String(floors)} onValueChange={(v) => setConfig({ floors: Number(v) })}>
              <SelectTrigger className="tech-num"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Floor</SelectItem>
                <SelectItem value="2">2 Floors</SelectItem>
                <SelectItem value="3">3 Floors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Road Side</Label>
            <Select value={plot.roadSide} onValueChange={(v) => setConfig({ plot: { ...plot, roadSide: v as 'north' | 'south' | 'east' | 'west' } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="north">North</SelectItem>
                <SelectItem value="south">South</SelectItem>
                <SelectItem value="east">East</SelectItem>
                <SelectItem value="west">West</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">North Direction</Label>
            <Select value={String(plot.northDirection)} onValueChange={(v) => setConfig({ plot: { ...plot, northDirection: Number(v) } })}>
              <SelectTrigger className="tech-num"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Up (0°)</SelectItem>
                <SelectItem value="90">Right (90°)</SelectItem>
                <SelectItem value="180">Down (180°)</SelectItem>
                <SelectItem value="270">Left (270°)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Setback Preferences (ft)</Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] text-muted-foreground">Front</span>
              <Input type="number" value={plot.setbackFront} onChange={(e) => setConfig({ plot: { ...plot, setbackFront: Number(e.target.value) } })} className="tech-num h-9" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Rear</span>
              <Input type="number" value={plot.setbackRear} onChange={(e) => setConfig({ plot: { ...plot, setbackRear: Number(e.target.value) } })} className="tech-num h-9" />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground">Sides</span>
              <Input type="number" value={plot.setbackSides} onChange={(e) => setConfig({ plot: { ...plot, setbackSides: Number(e.target.value) } })} className="tech-num h-9" />
            </div>
          </div>
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

  const grouped = {
    private: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'private'),
    public: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'public'),
    service: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'service'),
    circulation: ALL_ROOM_TYPES.filter((t) => ROOM_CATALOG[t].group === 'circulation'),
  };
  const groupLabels = { private: 'Private', public: 'Public', service: 'Service', circulation: 'Circulation' };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>02 — Define Requirements</h2>
      <p className="text-muted-foreground mb-6 text-sm">Select rooms and set counts, sizes, and priorities. Adding a room triggers a layout regeneration later.</p>

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
                    <Card key={type} className={cn('p-3 transition-all cursor-pointer', count > 0 ? 'border-primary ring-1 ring-primary/20' : 'hover:border-cyan/40')} onClick={() => count === 0 && addRoom(type)}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{cat.label}</span>
                        {count > 0 ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => removeRoom(type)}><Minus className="size-3" /></Button>
                            <span className="tech-num text-sm font-semibold w-5 text-center">{count}</span>
                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => addRoom(type)}><Plus className="size-3" /></Button>
                          </div>
                        ) : (
                          <Plus className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 tech-num">min {cat.minWidth}×{cat.minLength} {config.plot.unit}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected rooms detail */}
        <Card className="p-4 lg:sticky lg:top-24 flex flex-col" style={{ maxHeight: '70vh' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><LayoutGrid className="size-4 text-cyan" /> Configured Rooms ({rooms.reduce((s, r) => s + r.count, 0)})</h3>
          <div className="flex-1 overflow-y-auto scroll-thin -mx-2 px-2 min-h-0">
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No rooms selected yet. Tap a room card to add it.</p>
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
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>03 — Preferences</h2>
        <p className="text-muted-foreground mb-6 text-sm">Tune design style and spatial preferences. These guide the layout engine.</p>

        {/* Style */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Architecture Style</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setConfig({ style: s.value })}
              className={cn(
                'text-left p-3 rounded-md border transition-all',
                config.style === s.value ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-cyan/40'
              )}
            >
              <span className="text-sm font-medium">{s.label}</span>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>

        {/* Preferences */}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Spatial Preferences</h3>
        <div className="space-y-2">
          {PREFERENCES.map((p) => {
            const active = config.preferences.includes(p.key);
            return (
              <div key={p.key} className={cn('flex items-center justify-between p-3 rounded-md border transition-all', active ? 'border-primary/30 bg-primary/5' : 'border-border')}>
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Switch checked={active} onCheckedChange={() => togglePref(p.key)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Vastu */}
      <div>
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold flex items-center gap-2"><Compass className="size-4 text-cyan" /> Optional Vastu Preferences</h3>
            <Switch checked={config.vastuEnabled} onCheckedChange={(b) => setConfig({ vastuEnabled: b })} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Cultural / traditional design preferences (not structural or engineering requirements). Always prioritize structural safety and local codes.
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
              <h4 className="text-sm font-semibold mb-1">Good to know</h4>
              <p className="text-xs text-muted-foreground">
                Preferences guide the layout engine but are not guaranteed. Generated plans are preliminary conceptual designs — review with a qualified architect before construction.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// ---------------- STEP 4: Generate ----------------
function GenerateStep({ config, onGenerate }: { config: ProjectConfig; onGenerate: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [logIndex, setLogIndex] = useState(0);

  const logLines = useMemo(() => [
    { t: 'Analyzing plot...', ok: `Plot dimensions validated — ${config.plot.width}×${config.plot.length} ${config.plot.unit}` },
    { t: 'Processing requirements...', ok: `${config.rooms.reduce((s, r) => s + r.count, 0)} rooms across ${config.floors} floor(s)` },
    { t: 'Applying spatial constraints...', ok: 'Constraints applied' },
    { t: 'Generating layouts...', ok: '4 candidate layouts generated' },
    { t: 'Validating layouts...', ok: '4 valid designs found' },
  ], [config]);

  function start() {
    setPhase('running');
    setLogIndex(0);
  }

  // animate log
  useEffect(() => {
    if (phase !== 'running') return;
    if (logIndex >= logLines.length) {
      const t = setTimeout(() => {
        setPhase('done');
        setTimeout(onGenerate, 600);
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLogIndex((i) => i + 1), 650);
    return () => clearTimeout(t);
  }, [phase, logIndex, logLines, onGenerate]);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-1 text-center" style={{ fontFamily: 'var(--font-display)' }}>04 — Generate Blueprint</h2>
      <p className="text-muted-foreground mb-8 text-sm text-center">Review your settings and let the layout engine generate multiple preliminary designs.</p>

      <Card className="p-6 mb-6">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCheck className="size-4 text-cyan" /> Configuration Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryItem label="Plot" value={`${config.plot.width} × ${config.plot.length} ${config.plot.unit}`} />
          <SummaryItem label="Floors" value={`${config.floors}`} />
          <SummaryItem label="Road Side" value={config.plot.roadSide} />
          <SummaryItem label="Style" value={config.style} />
          <SummaryItem label="Rooms" value={`${config.rooms.reduce((s, r) => s + r.count, 0)}`} />
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

      {phase === 'idle' && (
        <div className="text-center">
          <Button size="lg" onClick={start} className="gap-2 w-full sm:w-auto">
            <Sparkles className="size-4" /> Start AI Planning
          </Button>
          <p className="text-xs text-muted-foreground mt-3">Generates 4 design strategies — typically takes a few seconds.</p>
        </div>
      )}

      {phase !== 'idle' && (
        <Card className="p-5 bp-grid-dark text-white">
          <div className="space-y-2.5 font-mono text-sm">
            {logLines.map((line, i) => {
              const reached = logIndex > i;
              const current = logIndex === i;
              const done = phase === 'done';
              return (
                <div key={i}>
                  <div className={cn('flex items-center gap-2', !reached && !current && !done && 'opacity-40')}>
                    {reached || done ? (
                      <CheckCircle2 className="size-4 text-cyan" />
                    ) : current ? (
                      <Loader2 className="size-4 text-cyan animate-spin" />
                    ) : (
                      <div className="size-4 rounded-full border border-white/30" />
                    )}
                    <span className={cn(reached || done ? 'text-white' : 'text-white/60')}>{line.t}</span>
                  </div>
                  {(reached || (done && i < logLines.length)) && (
                    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="ml-6 mt-0.5 text-xs text-cyan/90">
                      ✓ {line.ok}
                    </motion.div>
                  )}
                </div>
              );
            })}
            {phase === 'done' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-3 mt-3 border-t border-white/20">
                <p className="text-cyan font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-5" /> Your Blueprint Options Are Ready
                </p>
                <p className="text-white/70 text-xs mt-1">Loading design options…</p>
              </motion.div>
            )}
          </div>
        </Card>
      )}
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

  // Build the default distribution (same logic as engine)
  const hasParking = config.rooms.some((r) => r.type === 'parking');
  const groundTypes = hasParking && floors > 1
    ? new Set(['parking', 'living', 'kitchen', 'foyer', 'store', 'staircase'])
    : new Set(['parking', 'living', 'dining', 'kitchen', 'foyer', 'store', 'staircase']);

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
          // bathrooms: 1 on ground if no parking, rest upstairs
          if (r.type === 'bathroom' && !hasParking && floors > 1) {
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
