'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useApp } from '@/lib/store';
import { Brand } from '@/components/openblueprint/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Save,
  Download,
  Box,
  Square,
  Hand,
  Ruler,
  DoorOpen,
  AppWindow,
  ArrowUpWideNarrow,
  Sofa,
  MousePointer2,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Calculator,
  Palette,
  History,
  Lightbulb,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Loader2,
  RotateCcw,
  Plus,
  Trash2,
  Settings2,
  Building2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ProjectConfig,
  ScoredLayout,
  LayoutData,
  RoomRect,
  RoomType,
  ValidationResult,
  DesignInsight,
  CostEstimate,
  MaterialSelection,
  FinishGrade,
  DesignStyle,
} from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { cn } from '@/lib/utils';
import { BlueprintCanvas } from './blueprint-canvas';
import { AiAssistant } from './ai-assistant';
import { ValidationPanel } from './panels';
import { computeBuiltUpArea, estimateCost, formatINR } from '@/lib/cost/estimator';
import { validateLayout } from '@/lib/layout/engine';
import { generateInsights } from '@/lib/ai/apply-actions';
import { genId } from '@/lib/layout/engine';

const Viewer3D = dynamic(() => import('./viewer-3d').then((m) => m.Viewer3D), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-muted/20">
    <Loader2 className="size-8 animate-spin text-muted-foreground" />
  </div>
) });

interface Props {
  config: ProjectConfig;
  design: ScoredLayout;
  projectId: string | null;
}

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'room', icon: Square, label: 'Room' },
  { id: 'door', icon: DoorOpen, label: 'Door' },
  { id: 'window', icon: AppWindow, label: 'Window' },
  { id: 'stairs', icon: ArrowUpWideNarrow, label: 'Stairs' },
  { id: 'furniture', icon: Sofa, label: 'Furniture' },
  { id: 'measure', icon: Ruler, label: 'Measure' },
  { id: 'text', icon: Type, label: 'Text' },
] as const;

const RIGHT_TABS = [
  { id: 'validation', icon: ShieldCheck, label: 'Validation' },
  { id: 'space', icon: Layers, label: 'Space' },
  { id: 'cost', icon: Calculator, label: 'Cost' },
  { id: 'materials', icon: Palette, label: 'Materials' },
  { id: 'insights', icon: Lightbulb, label: 'Insights' },
  { id: 'knowledge', icon: BookOpen, label: 'Knowledge' },
  { id: 'versions', icon: History, label: 'Versions' },
] as const;

export function Workspace({ config, design, projectId }: Props) {
  const setView = useApp((s) => s.setView);
  const store = useApp();
  const [tool, setTool] = useState<string>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showWalls3d, setShowWalls3d] = useState(true);
  const [showFurniture3d, setShowFurniture3d] = useState(true);
  const [showLabels3d, setShowLabels3d] = useState(true);
  const [cameraView, setCameraView] = useState<'orbit' | 'top' | 'front' | 'isometric'>('orbit');
  const [zoom, setZoom] = useState(1);
  const [projectName, setProjectName] = useState('My 30×40 Home');
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [versions, setVersions] = useState<{ id: string; name: string; note: string; layout: LayoutData; at: number }[]>([
    { id: genId('v'), name: 'Version 1', note: 'Original Design', layout: design.layout, at: Date.now() },
  ]);

  // layout is the live source of truth in the store
  const layout = useApp((s) => s.currentLayout) || design.layout;
  const setLayout = useApp((s) => s.setCurrentLayout);
  const selectedRoomId = useApp((s) => s.selectedRoomId);
  const setSelectedRoom = useApp((s) => s.setSelectedRoom);
  const view2d = useApp((s) => s.view2d);
  const setView2d = useApp((s) => s.setView2d);
  const currentFloor = useApp((s) => s.currentFloor);
  const setCurrentFloor = useApp((s) => s.setCurrentFloor);
  const showAllFloors = useApp((s) => s.showAllFloors);
  const setShowAllFloors = useApp((s) => s.setShowAllFloors);
  const accentColor = useApp((s) => s.accentColor);
  const setAccentColor = useApp((s) => s.setAccentColor);
  const materials = useApp((s) => s.materials);
  const setMaterials = useApp((s) => s.setMaterials);
  const finish = useApp((s) => s.finish);
  const setFinish = useApp((s) => s.setFinish);
  const style = useApp((s) => s.style);
  const setStyle = useApp((s) => s.setStyle);
  const rightPanel = useApp((s) => s.rightPanel);
  const setRightPanel = useApp((s) => s.setRightPanel);

  // derived
  const validation: ValidationResult = useMemo(() => validateLayout(layout, config), [layout, config]);
  const insights: DesignInsight[] = useMemo(() => generateInsights(layout, config), [layout, config]);
  const cost: CostEstimate = useMemo(() => estimateCost(layout, finish, materials), [layout, finish, materials]);
  const builtUp = computeBuiltUpArea(layout);

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2600);
  }

  // room operations
  const updateRoom = useCallback((id: string, patch: Partial<RoomRect>) => {
    setLayout({ ...layout, rooms: layout.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }, [layout, setLayout]);

  const deleteRoom = useCallback((id: string) => {
    setLayout({ ...layout, rooms: layout.rooms.filter((r) => r.id !== id) });
    setSelectedRoom(null);
  }, [layout, setLayout, setSelectedRoom]);

  const addRoom = useCallback((type: RoomType) => {
    const cat = ROOM_CATALOG[type];
    const newRoom: RoomRect = {
      id: genId(),
      type,
      name: cat.defaultName,
      x: 2,
      y: 2,
      width: cat.preferredWidth,
      length: cat.preferredLength,
      floor: currentFloor,
      doors: [{ wall: 'top', pos: 0.5, width: 3 }],
      windows: [],
    };
    setLayout({ ...layout, rooms: [...layout.rooms, newRoom] });
    setSelectedRoom(newRoom.id);
  }, [layout, setLayout, currentFloor, setSelectedRoom]);

  // save version
  const saveVersion = useCallback((note: string) => {
    const v = { id: genId('v'), name: `Version ${versions.length + 1}`, note, layout: { ...layout }, at: Date.now() };
    setVersions([...versions, v]);
    showToast('Version saved');
  }, [layout, versions]);

  // save project
  const saveProject = useCallback(async () => {
    try {
      const body = { name: projectName, config, design: { ...design, layout }, accentColor };
      if (projectId) {
        await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        // switch to workspace with new project id
        setView({ name: 'workspace', projectId: data.project.id, config, design: { ...design, layout } });
      }
      showToast('Project saved');
    } catch {
      showToast('Save failed', 'err');
    }
  }, [projectName, config, design, layout, accentColor, projectId, setView]);

  const selectedRoom = layout.rooms.find((r) => r.id === selectedRoomId) || null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setView({ name: 'dashboard' })}>
            <ArrowLeft className="size-4" />
          </Button>
          <button onClick={() => setView({ name: 'landing' })} className="shrink-0 hidden sm:block">
            <Brand size={24} />
          </button>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <Building2 className="size-4 text-muted-foreground hidden sm:block shrink-0" />
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-8 w-40 sm:w-56 border-transparent hover:border-border focus-visible:border-border bg-transparent font-medium"
          />
          <Badge variant="outline" className="hidden md:inline-flex tech-num capitalize">{config.style}</Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setAiPanelOpen(!aiPanelOpen)} className="gap-1.5">
                  <Sparkles className="size-4 text-cyan" /> <span className="hidden sm:inline">AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Design Assistant</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={saveProject} className="gap-1.5">
            <Save className="size-4" /> <span className="hidden sm:inline">Save</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5">
            <Download className="size-4" /> <span className="hidden sm:inline">Export</span>
          </Button>
          {/* 2D / 3D switch */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/40">
            <button
              onClick={() => setView2d(true)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors', view2d ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}
            >
              <Square className="size-3.5" /> 2D
            </button>
            <button
              onClick={() => setView2d(false)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors', !view2d ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground')}
            >
              <Box className="size-3.5" /> 3D
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left tool panel */}
        <aside className="w-14 sm:w-16 border-r border-border bg-card flex flex-col items-center py-3 gap-1 shrink-0 overflow-y-auto scroll-thin">
          {TOOLS.map((t) => (
            <TooltipProvider key={t.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTool(t.id)}
                    className={cn(
                      'size-10 rounded-md flex items-center justify-center transition-colors',
                      tool === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <t.icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          <Separator className="my-2 w-8" />
          {/* Add room quick actions */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => addRoom('bedroom')} className="size-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Plus className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Add Bedroom</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </aside>

        {/* Center canvas area */}
        <main className="flex-1 flex flex-col min-w-0 bg-muted/20 relative">
          {/* sub-toolbar */}
          <div className="h-10 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-3 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto scroll-thin">
              {view2d ? (
                <>
                  <ToggleChip active={showGrid} onClick={() => setShowGrid(!showGrid)} icon={Grid2} label="Grid" />
                  <ToggleChip active={showDims} onClick={() => setShowDims(!showDims)} icon={Ruler} label="Dims" />
                  <ToggleChip active={showLabels} onClick={() => setShowLabels(!showLabels)} icon={Type} label="Labels" />
                  <Separator orientation="vertical" className="h-5" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Floor:</span>
                  <FloorSelector floors={layout.floors} current={currentFloor} onChange={setCurrentFloor} showAll={showAllFloors} onShowAll={setShowAllFloors} />
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Camera:</span>
                  {(['orbit', 'isometric', 'front', 'top'] as const).map((v) => (
                    <button key={v} onClick={() => setCameraView(v)} className={cn('text-xs px-2 py-1 rounded capitalize', cameraView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{v}</button>
                  ))}
                  <Separator orientation="vertical" className="h-5" />
                  <ToggleChip active={showWalls3d} onClick={() => setShowWalls3d(!showWalls3d)} icon={Box} label="Walls" />
                  <ToggleChip active={showFurniture3d} onClick={() => setShowFurniture3d(!showFurniture3d)} icon={Sofa} label="Furniture" />
                  <ToggleChip active={showLabels3d} onClick={() => setShowLabels3d(!showLabels3d)} icon={Type} label="Labels" />
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}><ZoomOut className="size-3.5" /></Button>
              <span className="text-xs tech-num w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}><ZoomIn className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setZoom(1)} title="Reset"><Maximize className="size-3.5" /></Button>
            </div>
          </div>

          {/* Canvas / 3D */}
          <div className="flex-1 min-h-0 relative">
            {view2d ? (
              <BlueprintCanvas
                layout={layout}
                config={config}
                tool={tool}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoom}
                onUpdateRoom={updateRoom}
                onDeleteRoom={deleteRoom}
                onAddRoom={addRoom}
                currentFloor={currentFloor}
                showAllFloors={showAllFloors}
                showGrid={showGrid}
                showDims={showDims}
                showLabels={showLabels}
                zoom={zoom}
                accentColor={accentColor}
                validation={validation}
              />
            ) : (
              <div className="absolute inset-0">
                <Viewer3D
                  layout={layout}
                  floor={currentFloor}
                  showAllFloors={showAllFloors}
                  accentColor={accentColor}
                  style={style}
                  showWalls={showWalls3d}
                  showFurniture={showFurniture3d}
                  showLabels={showLabels3d}
                  cameraView={cameraView}
                />
              </div>
            )}

            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={cn('absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md shadow-lg flex items-center gap-2 text-sm z-20', toast.kind === 'ok' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-white')}
                >
                  {toast.kind === 'ok' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                  {toast.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status bar */}
          <div className="h-8 border-t border-border bg-card flex items-center justify-between px-3 text-xs shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn('flex items-center gap-1 font-medium', validation.valid ? 'text-emerald-600' : 'text-destructive')}>
                {validation.valid ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                {validation.valid ? 'Layout valid' : `${validation.errors.length} issue(s)`}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground tech-num">Area: <b className="text-foreground">{builtUp.toLocaleString()} sq.ft</b></span>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-muted-foreground hidden sm:inline tech-num">Rooms: <b className="text-foreground">{layout.rooms.length}</b></span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="tech-num hidden sm:inline">Score: <b className="text-primary">{design.score.total}/100</b></span>
              <span className="tech-num">Zoom: <b className="text-foreground">{Math.round(zoom * 100)}%</b></span>
            </div>
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-80 lg:w-96 border-l border-border bg-card flex flex-col shrink-0 overflow-hidden">
          {/* AI Assistant (always at top) */}
          {aiPanelOpen && (
            <AiAssistant layout={layout} config={config} onApplyLayout={(l) => { setLayout(l); showToast('AI changes applied'); }} />
          )}
          {/* Right tabs */}
          <div className="border-t border-border flex items-center gap-0.5 px-1 h-11 shrink-0 overflow-x-auto scroll-thin">
            {RIGHT_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setRightPanel(t.id as typeof rightPanel)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap', rightPanel === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
              >
                <t.icon className="size-3.5" /> <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {rightPanel === 'validation' && <ValidationPanel validation={validation} />}
              {rightPanel === 'space' && <SpaceAnalysis layout={layout} config={config} builtUp={builtUp} selectedRoom={selectedRoom} />}
              {rightPanel === 'cost' && <CostPanel layout={layout} cost={cost} finish={finish} setFinish={setFinish} materials={materials} setMaterials={setMaterials} />}
              {rightPanel === 'materials' && <MaterialsPanel materials={materials} setMaterials={setMaterials} accentColor={accentColor} setAccentColor={setAccentColor} />}
              {rightPanel === 'insights' && <InsightsPanel insights={insights} />}
              {rightPanel === 'knowledge' && <KnowledgePanel />}
              {rightPanel === 'versions' && <VersionsPanel versions={versions} onRestore={(l) => { setLayout(l); showToast('Version restored'); }} onSave={saveVersion} />}
            </div>
          </ScrollArea>
        </aside>
      </div>

      {/* Export modal */}
      <ExportModal open={exportOpen} onOpenChange={setExportOpen} layout={layout} config={config} projectName={projectName} finish={finish} materials={materials} accentColor={accentColor} showToast={showToast} />
    </div>
  );
}

function Grid2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

function ToggleChip({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick} className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
      <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FloorSelector({ floors, current, onChange, showAll, onShowAll }: { floors: number; current: number; onChange: (f: number) => void; showAll: boolean; onShowAll: (b: boolean) => void }) {
  const labels = ['Ground', 'First', 'Second', 'Third'];
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: floors }, (_, i) => (
        <button key={i} onClick={() => { onChange(i); onShowAll(false); }} className={cn('text-xs px-2 py-1 rounded tech-num', !showAll && current === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
          {labels[i]}
        </button>
      ))}
      <button onClick={() => onShowAll(!showAll)} className={cn('text-xs px-2 py-1 rounded flex items-center gap-1', showAll ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
        {showAll ? <EyeOff className="size-3" /> : <Eye className="size-3" />} All
      </button>
    </div>
  );
}

// ===== Space Analysis =====
function SpaceAnalysis({ layout, config, builtUp, selectedRoom }: { layout: LayoutData; config: ProjectConfig; builtUp: number; selectedRoom: RoomRect | null }) {
  const plotArea = layout.plot.width * layout.plot.length;
  const openArea = Math.max(0, plotArea - builtUp);
  const utilization = plotArea > 0 ? Math.round((builtUp / plotArea) * 100) : 0;
  const roomCount = layout.rooms.length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Layers className="size-4 text-cyan" /> Space Analysis</h3>
        <div className="space-y-2">
          <StatRow label="Plot Area" value={`${plotArea.toLocaleString()} sq.ft`} />
          <StatRow label="Built-up Area" value={`${builtUp.toLocaleString()} sq.ft`} highlight />
          <StatRow label="Open Area" value={`${openArea.toLocaleString()} sq.ft`} />
          <StatRow label="Space Utilization" value={`${utilization}%`} />
          <StatRow label="Rooms" value={`${roomCount}`} />
          <StatRow label="Floors" value={`${layout.floors}`} />
        </div>
        {/* utilization bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Utilization</span>
            <span className="tech-num">{utilization}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${utilization}%` }} transition={{ duration: 0.6 }} />
          </div>
        </div>
      </div>

      <Separator />

      {selectedRoom ? (
        <RoomAnalysis room={selectedRoom} layout={layout} />
      ) : (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Square className="size-6 mx-auto mb-2 opacity-40" />
          Select a room to see its details.
        </div>
      )}
    </div>
  );
}

function RoomAnalysis({ room, layout }: { room: RoomRect; layout: LayoutData }) {
  const cat = ROOM_CATALOG[room.type];
  const area = Math.round(room.width * room.length);
  const suitable = room.width >= cat.minWidth && room.length >= cat.minLength;
  // connected rooms (adjacent)
  const connected = layout.rooms.filter((r) => r.id !== room.id && (
    Math.abs(r.x - (room.x + room.width)) < 0.5 || Math.abs((r.x + r.width) - room.x) < 0.5 ||
    Math.abs(r.y - (room.y + room.length)) < 0.5 || Math.abs((r.y + r.length) - room.y) < 0.5
  )).slice(0, 4);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-sm" style={{ background: cat.color, border: `1px solid ${cat.accent}` }} />
        <h3 className="text-sm font-semibold">{room.name}</h3>
        <Badge variant="outline" className="text-[10px] capitalize">{cat.group}</Badge>
      </div>
      <div className="space-y-2">
        <StatRow label="Dimensions" value={`${room.width}' × ${room.length}'`} />
        <StatRow label="Area" value={`${area} sq.ft`} highlight />
        <StatRow label="Floor" value={`${room.floor + 1}`} />
        <StatRow label="Status" value={suitable ? '✓ Suitable' : '⚠ Below minimum'} />
        <StatRow label="Doors" value={`${room.doors.length}`} />
        <StatRow label="Windows" value={`${room.windows.length}`} />
      </div>
      {connected.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Connected</p>
          <div className="flex flex-wrap gap-1">
            {connected.map((r) => (
              <Badge key={r.id} variant="secondary" className="text-[10px]">{r.name}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tech-num font-medium', highlight && 'text-primary')}>{value}</span>
    </div>
  );
}

// ===== Cost Panel =====
function CostPanel({ layout, cost, finish, setFinish, materials, setMaterials }: {
  layout: LayoutData;
  cost: CostEstimate;
  finish: FinishGrade;
  setFinish: (f: FinishGrade) => void;
  materials: MaterialSelection;
  setMaterials: (m: Partial<MaterialSelection>) => void;
}) {
  const grades: FinishGrade[] = ['basic', 'standard', 'premium', 'luxury'];
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Calculator className="size-4 text-cyan" /> Cost Estimator</h3>
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-muted-foreground mb-1">Estimated Cost</p>
        <motion.p key={cost.total} initial={{ opacity: 0.5, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold tech-num text-primary" style={{ fontFamily: 'var(--font-display)' }}>
          {formatINR(cost.total)}
        </motion.p>
        <p className="text-xs text-muted-foreground tech-num mt-0.5">{cost.area.toLocaleString()} sq.ft @ ₹{cost.ratePerSqft}/sq.ft</p>
        <Badge variant="outline" className="mt-2 capitalize text-[10px]">Preliminary Estimate · {cost.grade}</Badge>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Construction Grade</p>
        <div className="grid grid-cols-2 gap-1.5">
          {grades.map((g) => (
            <button key={g} onClick={() => setFinish(g)} className={cn('text-xs px-3 py-2 rounded border capitalize transition-all', finish === g ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Breakdown</p>
        <div className="space-y-1.5">
          {Object.entries(cost.breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="tech-num font-medium">{formatINR(v as number)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded bg-amber-soft/10 border border-amber-soft/30 text-[10px] text-muted-foreground">
        Indicative estimate based on generic Indian construction rates (2024). Actual costs vary by location, finishes, and complexity. Consult a quantity surveyor.
      </div>
    </div>
  );
}

// ===== Materials Panel =====
function MaterialsPanel({ materials, setMaterials, accentColor, setAccentColor }: {
  materials: MaterialSelection;
  setMaterials: (m: Partial<MaterialSelection>) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}) {
  const flooringOpts: { v: MaterialSelection['flooring']; l: string }[] = [
    { v: 'ceramic', l: 'Ceramic' }, { v: 'vitrified', l: 'Vitrified' }, { v: 'marble', l: 'Marble' }, { v: 'wood', l: 'Wood-style' },
  ];
  const doorOpts: { v: MaterialSelection['doors']; l: string }[] = [
    { v: 'wood', l: 'Wood' }, { v: 'engineered', l: 'Engineered Wood' }, { v: 'panel', l: 'Modern Panel' },
  ];
  const windowOpts: { v: MaterialSelection['windows']; l: string }[] = [
    { v: 'aluminium', l: 'Aluminium' }, { v: 'upvc', l: 'uPVC' }, { v: 'wood', l: 'Wood' },
  ];
  const accentPresets = ['#2b4a7a', '#2b6fe0', '#0ea5b7', '#1a8f5a', '#a85a1f', '#7a3b7a'];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Palette className="size-4 text-cyan" /> Materials & Style</h3>

      <div>
        <p className="text-xs text-muted-foreground mb-2">Flooring</p>
        <div className="grid grid-cols-2 gap-1.5">
          {flooringOpts.map((o) => (
            <button key={o.v} onClick={() => setMaterials({ flooring: o.v })} className={cn('text-xs px-2.5 py-2 rounded border', materials.flooring === o.v ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>{o.l}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Doors</p>
        <div className="grid grid-cols-3 gap-1.5">
          {doorOpts.map((o) => (
            <button key={o.v} onClick={() => setMaterials({ doors: o.v })} className={cn('text-xs px-2.5 py-2 rounded border', materials.doors === o.v ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>{o.l}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Windows</p>
        <div className="grid grid-cols-3 gap-1.5">
          {windowOpts.map((o) => (
            <button key={o.v} onClick={() => setMaterials({ windows: o.v })} className={cn('text-xs px-2.5 py-2 rounded border', materials.windows === o.v ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>{o.l}</button>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs text-muted-foreground mb-2">Accent Color</p>
        <div className="flex flex-wrap gap-2 items-center">
          {accentPresets.map((c) => (
            <button key={c} onClick={() => setAccentColor(c)} className={cn('size-7 rounded-full border-2 transition-transform', accentColor === c ? 'border-foreground scale-110' : 'border-transparent')} style={{ background: c }} />
          ))}
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="size-7 rounded cursor-pointer bg-transparent" />
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">Architecture Style</p>
        <StyleSelector value={useApp.getState().style} onChange={(s) => useApp.getState().setStyle(s)} />
      </div>
    </div>
  );
}

function StyleSelector({ value, onChange }: { value: DesignStyle; onChange: (s: DesignStyle) => void }) {
  const styles: { v: DesignStyle; l: string }[] = [
    { v: 'modern', l: 'Modern' }, { v: 'minimal', l: 'Minimal' }, { v: 'traditional', l: 'Traditional' }, { v: 'contemporary', l: 'Contemporary' }, { v: 'luxury', l: 'Luxury' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {styles.map((s) => (
        <button key={s.v} onClick={() => onChange(s.v)} className={cn('text-xs px-2.5 py-2 rounded border capitalize', value === s.v ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>{s.l}</button>
      ))}
    </div>
  );
}

// ===== Insights Panel =====
function InsightsPanel({ insights }: { insights: DesignInsight[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Lightbulb className="size-4 text-cyan" /> AI Design Insights</h3>
      <div className="space-y-2">
        {insights.map((ins, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className={cn('p-3 rounded-md border text-xs', ins.kind === 'positive' ? 'border-emerald-200 bg-emerald-50' : ins.kind === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-cyan/30 bg-cyan/5')}>
            <div className="flex items-start gap-2">
              {ins.kind === 'positive' ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" /> : ins.kind === 'warning' ? <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" /> : <Lightbulb className="size-4 text-cyan shrink-0 mt-0.5" />}
              <div>
                <p className="font-medium text-foreground">{ins.title}</p>
                <p className="text-muted-foreground mt-0.5">{ins.detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Insights are recommendations, not claims of regulatory compliance.</p>
    </div>
  );
}

// ===== Knowledge Panel (RAG) =====
function KnowledgePanel() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(question?: string) {
    const query = question || q;
    if (!query.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/ai/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: query }) });
      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch {
      setAnswer('Could not retrieve an answer right now.');
    } finally {
      setLoading(false);
    }
  }

  const suggestions = ['What should I consider when planning a bedroom?', 'What is a good kitchen layout?', 'What factors affect construction cost?', 'What does built-up area mean?'];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><BookOpen className="size-4 text-cyan" /> Ask OpenBlueprint</h3>
      <p className="text-xs text-muted-foreground">Contextual architectural & construction knowledge.</p>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Ask a question..." className="text-sm h-9" />
        <Button size="icon" className="size-9 shrink-0" onClick={() => ask()} disabled={loading}><Send className="size-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setQ(s); ask(s); }} className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:border-cyan/40 hover:text-foreground text-left">{s}</button>
        ))}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" /> Retrieving knowledge...
        </div>
      )}
      {answer && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-md bg-muted/50 text-xs leading-relaxed whitespace-pre-wrap">
          {answer}
          {sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/60">
              <p className="text-[10px] text-muted-foreground mb-1">Sources:</p>
              {sources.map((s, i) => <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>)}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ===== Versions Panel =====
function VersionsPanel({ versions, onRestore, onSave }: {
  versions: { id: string; name: string; note: string; layout: LayoutData; at: number }[];
  onRestore: (l: LayoutData) => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><History className="size-4 text-cyan" /> Version History</h3>
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Version note (e.g. Larger Kitchen)" className="text-sm h-9" />
        <Button size="sm" onClick={() => { onSave(note || 'Manual save'); setNote(''); }} className="gap-1 shrink-0"><Plus className="size-3.5" /> Save</Button>
      </div>
      <div className="space-y-2">
        {[...versions].reverse().map((v) => (
          <div key={v.id} className="p-3 rounded-md border border-border hover:border-cyan/40 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{v.name}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(v.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{v.note}</p>
            <Button size="sm" variant="outline" className="h-7 w-full text-xs gap-1" onClick={() => onRestore(v.layout)}><RotateCcw className="size-3" /> Restore</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ExportModal is in a separate file
import { ExportModal } from './export-modal';
