'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, furnitureByCategory, FURNITURE_MAP } from '@/lib/furniture-catalog';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { FurnitureSymbol } from './furniture-symbol';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Sofa,
  Search,
  DoorOpen,
  AppWindow,
  ArrowUpWideNarrow,
  Square,
  Trash2,
  RotateCw,
  Copy,
  ArrowRightLeft,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { FurnitureItem, FurnitureType, LayoutData, RoomRect, RoomType } from '@/lib/types';

interface Props {
  tool: string;
  selectedRoom: RoomRect | null;
  layout: LayoutData;
  currentFloor: number;
  onAddFurniture: (type: FurnitureType, x: number, y: number) => void;
  onAddRoom?: (type: RoomType) => void;
  onUpdateRoom: (id: string, patch: Partial<RoomRect>) => void;
  onDeleteRoom: (id: string) => void;
  onUpdateFurniture: (id: string, patch: Partial<FurnitureItem>) => void;
  selectedFurnitureId: string | null;
  onDeleteFurniture: (id: string) => void;
  onSelectRoom: (id: string | null) => void;
}

export function ToolPanel(props: Props) {
  const { tool } = props;
  return (
    <div className="flex flex-col h-full min-h-0">
      {tool === 'furniture' && <FurnitureToolPanel {...props} />}
      {tool === 'room' && <RoomToolPanel {...props} />}
      {tool === 'door' && <DoorToolPanel {...props} />}
      {tool === 'window' && <WindowToolPanel {...props} />}
      {tool === 'stairs' && <StairsToolPanel {...props} />}
    </div>
  );
}

// ============ FURNITURE TOOL ============
function FurnitureToolPanel(props: Props) {
  const { onAddFurniture, layout, selectedFurnitureId, onUpdateFurniture, onDeleteFurniture } = props;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('living');

  const selectedFurniture = layout.furniture.find((f) => f.id === selectedFurnitureId) || null;
  const items = search
    ? FURNITURE_CATALOG.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : furnitureByCategory(category);

  function handleDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/x-furniture-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleQuickAdd(type: string) {
    if (layout) {
      const x = layout.plot.width / 2 - 3;
      const y = layout.plot.length / 2 - 3;
      onAddFurniture(type as FurnitureType, x, y);
    }
  }

  // If a furniture item is selected, show its editor instead of the library
  if (selectedFurniture) {
    return <FurnitureEditor item={selectedFurniture} onUpdate={(patch) => onUpdateFurniture(selectedFurniture.id, patch)} onDelete={() => onDeleteFurniture(selectedFurniture.id)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Sofa className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Furniture</p>
            <p className="text-[10px] text-muted-foreground">Drag to canvas or click to add</p>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 relative">
        <Search className="size-3.5 absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search furniture..." className="h-8 pl-8 text-xs" />
      </div>
      {!search && (
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto scroll-thin">
          {FURNITURE_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} className={cn('text-[10px] px-2 py-1 rounded-md whitespace-nowrap font-medium transition-colors', category === c.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{c.label}</button>
          ))}
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-2 p-3">
          {items.map((f) => (
            <div key={f.type} draggable onDragStart={(e) => handleDragStart(e, f.type)} onDoubleClick={() => handleQuickAdd(f.type)} className="group cursor-grab active:cursor-grabbing rounded-md border border-border bg-background hover:border-primary/40 hover:shadow-sm transition-all p-2 flex flex-col items-center gap-1" title={`${f.name} — drag to canvas or double-click to add`}>
              <div className="w-full aspect-square bg-muted/30 rounded p-1 flex items-center justify-center">
                <FurnitureSymbol type={f.type} color={f.color} className="w-full h-full" />
              </div>
              <p className="text-[10px] font-medium text-center leading-tight line-clamp-2">{f.name}</p>
              <p className="text-[9px] text-muted-foreground tech-num">{f.width}×{f.length}'</p>
            </div>
          ))}
        </div>
        {items.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">No furniture found</div>
        )}
      </ScrollArea>
      <div className="p-2 border-t border-border bg-muted/20">
        <p className="text-[9px] text-muted-foreground text-center leading-tight">Drag onto plan, or double-click to add at center. Press R to rotate, Delete to remove.</p>
      </div>
    </div>
  );
}

// Furniture editor — shown when a furniture item is selected
function FurnitureEditor({ item, onUpdate, onDelete }: { item: FurnitureItem; onUpdate: (patch: Partial<FurnitureItem>) => void; onDelete: () => void }) {
  const cat = FURNITURE_MAP[item.type];
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <div className="size-7 rounded bg-primary/10 flex items-center justify-center">
          <Sofa className="size-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{cat?.name || item.name}</p>
          <p className="text-[10px] text-muted-foreground">Selected furniture</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Preview */}
          <div className="aspect-square bg-muted/30 rounded-md p-3 flex items-center justify-center">
            <FurnitureSymbol type={item.type} color={item.color || cat?.color || '#999'} className="w-full h-full" />
          </div>

          {/* Position */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Position (ft)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">X</span>
                <Input type="number" step="0.5" value={item.x} onChange={(e) => onUpdate({ x: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Y</span>
                <Input type="number" step="0.5" value={item.y} onChange={(e) => onUpdate({ y: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Size (ft)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Width</span>
                <Input type="number" step="0.5" min="0.5" value={item.width} onChange={(e) => onUpdate({ width: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Length</span>
                <Input type="number" step="0.5" min="0.5" value={item.length} onChange={(e) => onUpdate({ length: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Rotation</Label>
            <div className="grid grid-cols-4 gap-1">
              {[0, 90, 180, 270].map((r) => (
                <button key={r} onClick={() => onUpdate({ rotation: r })} className={cn('text-xs py-1.5 rounded border tech-num', item.rotation === r ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>{r}°</button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="w-full mt-1.5 h-7 text-xs gap-1" onClick={() => onUpdate({ rotation: ((item.rotation + 90) % 360 + 360) % 360 })}>
              <RotateCw className="size-3" /> Rotate 90°
            </Button>
          </div>

          {/* Floor */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Floor</Label>
            <Select value={String(item.floor)} onValueChange={(v) => onUpdate({ floor: Number(v) })}>
              <SelectTrigger className="h-8 text-xs tech-num"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2].map((f) => <SelectItem key={f} value={String(f)}>{['Ground', 'First', 'Second'][f]} Floor</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={item.color || cat?.color || '#999'} onChange={(e) => onUpdate({ color: e.target.value })} className="size-8 rounded cursor-pointer" />
              <span className="text-xs text-muted-foreground tech-num">{item.color || cat?.color}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => onUpdate({ rotation: ((item.rotation + 90) % 360 + 360) % 360 })}>
              <RotateCw className="size-3" /> Rotate
            </Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={onDelete}>
              <Trash2 className="size-3" /> Delete
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ ROOM TOOL ============
function RoomToolPanel(props: Props) {
  const { selectedRoom, onUpdateRoom, onDeleteRoom, layout, onSelectRoom, currentFloor } = props;
  if (!selectedRoom) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader icon={Square} title="Room Tool" subtitle="Click a room to edit, or click empty space to add" />
        <div className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">Quick add room:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['bedroom', 'bathroom', 'kitchen', 'living', 'dining', 'office', 'pooja', 'utility', 'store', 'balcony'] as RoomType[]).map((t) => (
              <button key={t} onClick={() => props.onAddRoom?.(t)} className="text-[10px] px-2 py-1.5 rounded border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground capitalize text-left">
                {ROOM_CATALOG[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const cat = ROOM_CATALOG[selectedRoom.type];
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={Square} title="Room Editor" subtitle={selectedRoom.name} />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Name */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
            <Input value={selectedRoom.name} onChange={(e) => onUpdateRoom(selectedRoom.id, { name: e.target.value })} className="h-8 text-xs" />
          </div>

          {/* Position */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Position (ft)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">X</span>
                <Input type="number" step="0.5" value={selectedRoom.x} onChange={(e) => onUpdateRoom(selectedRoom.id, { x: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Y</span>
                <Input type="number" step="0.5" value={selectedRoom.y} onChange={(e) => onUpdateRoom(selectedRoom.id, { y: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Size (ft)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Width</span>
                <Input type="number" step="0.5" min="4" value={selectedRoom.width} onChange={(e) => onUpdateRoom(selectedRoom.id, { width: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Length</span>
                <Input type="number" step="0.5" min="4" value={selectedRoom.length} onChange={(e) => onUpdateRoom(selectedRoom.id, { length: Number(e.target.value) })} className="tech-num h-8 text-xs" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 tech-num">Area: {Math.round(selectedRoom.width * selectedRoom.length)} sq.ft · Min: {cat.minWidth}×{cat.minLength}</p>
          </div>

          {/* Floor — move room to different floor */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Move to Floor</Label>
            <div className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((f) => (
                <button key={f} disabled={f >= layout.floors} onClick={() => onUpdateRoom(selectedRoom.id, { floor: f })} className={cn('text-xs py-1.5 rounded border tech-num disabled:opacity-30', selectedRoom.floor === f ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-cyan/40')}>
                  {['Ground', 'First', 'Second'][f]}
                </button>
              ))}
            </div>
          </div>

          {/* Doors count */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Doors ({selectedRoom.doors.length})</Label>
            <p className="text-[10px] text-muted-foreground">Use the Door tool to add/edit doors on walls.</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Windows ({selectedRoom.windows.length})</Label>
            <p className="text-[10px] text-muted-foreground">Use the Window tool to add/edit windows on walls.</p>
          </div>

          {/* Split room — zig-zag flexibility to manage free spaces */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Split Room (Zig-Zag)</Label>
            <p className="text-[10px] text-muted-foreground mb-2">Split this room into two parts. The two halves share an open boundary (no wall between them) so they flow as one space.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={selectedRoom.width < 10} onClick={() => {
                // Split vertically (left/right halves)
                const w2 = Math.round(selectedRoom.width / 2 * 2) / 2;
                const layout2 = useApp.getState().currentLayout;
                if (!layout2) return;
                const newId = `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
                const newRoom: RoomRect = {
                  id: newId,
                  type: selectedRoom.type,
                  name: `${selectedRoom.name} B`,
                  x: selectedRoom.x + w2,
                  y: selectedRoom.y,
                  width: selectedRoom.width - w2,
                  length: selectedRoom.length,
                  floor: selectedRoom.floor,
                  doors: [],
                  windows: [],
                  splitPartner: selectedRoom.id, // no wall between the two halves
                };
                useApp.getState().setCurrentLayout({
                  ...layout2,
                  rooms: layout2.rooms.map((r) => r.id === selectedRoom.id ? { ...r, width: w2, name: `${r.name} A`, splitPartner: newId } : r).concat(newRoom),
                });
              }}>
                <ArrowRightLeft className="size-3" /> Split ↕
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={selectedRoom.length < 10} onClick={() => {
                // Split horizontally (top/bottom halves)
                const l2 = Math.round(selectedRoom.length / 2 * 2) / 2;
                const layout2 = useApp.getState().currentLayout;
                if (!layout2) return;
                const newId = `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
                const newRoom: RoomRect = {
                  id: newId,
                  type: selectedRoom.type,
                  name: `${selectedRoom.name} B`,
                  x: selectedRoom.x,
                  y: selectedRoom.y + l2,
                  width: selectedRoom.width,
                  length: selectedRoom.length - l2,
                  floor: selectedRoom.floor,
                  doors: [],
                  windows: [],
                  splitPartner: selectedRoom.id,
                };
                useApp.getState().setCurrentLayout({
                  ...layout2,
                  rooms: layout2.rooms.map((r) => r.id === selectedRoom.id ? { ...r, length: l2, name: `${r.name} A`, splitPartner: newId } : r).concat(newRoom),
                });
              }}>
                <ArrowRightLeft className="size-3" /> Split ↔
              </Button>
            </div>
          </div>

          {/* Auto-arrange: regenerate the layout with the current room configuration */}
          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1" onClick={() => {
            const layout2 = useApp.getState().currentLayout;
            if (!layout2) return;
            // Build a config from the current layout's rooms and regenerate
            const config2 = {
              plot: layout2.plot,
              floors: layout2.floors,
              rooms: layout2.rooms.reduce((acc, r) => {
                const existing = acc.find((rr) => rr.type === r.type);
                if (existing) existing.count++;
                else acc.push({ type: r.type, name: r.name, count: 1, minWidth: r.width, minLength: r.length, preferredWidth: r.width, preferredLength: r.length, priority: 'medium' as const });
                return acc;
              }, [] as import('@/lib/types').RoomRequirement[]),
              style: 'modern' as const,
              preferences: [],
              vastuEnabled: false,
              vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
            };
            import('@/lib/layout/engine').then(({ generateLayout }) => {
              const newLayout = generateLayout(config2, layout2.strategy);
              useApp.getState().setCurrentLayout(newLayout);
            });
          }}>
            <Sparkles className="size-3" /> Auto-Arrange Rooms
          </Button>

          <Button size="sm" variant="destructive" className="w-full h-8 text-xs gap-1" onClick={() => onDeleteRoom(selectedRoom.id)}>
            <Trash2 className="size-3" /> Delete Room
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ DOOR TOOL ============
function DoorToolPanel(props: Props) {
  const { selectedRoom, onUpdateRoom, layout } = props;
  if (!selectedRoom) {
    return <EmptyTool icon={DoorOpen} title="Door Tool" subtitle="Select a room to add or edit its doors. Click on a wall to place a door." />;
  }
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={DoorOpen} title="Doors" subtitle={selectedRoom.name} />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground mb-2">Doors on walls of <b>{selectedRoom.name}</b>. Click a wall in the canvas to add a door, or edit positions below.</p>
          {selectedRoom.doors.length === 0 && <p className="text-xs text-muted-foreground italic">No doors yet. Click a wall to add one.</p>}
          {selectedRoom.doors.map((d, i) => (
            <div key={i} className="p-2 rounded border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize">Door {i + 1}</span>
                <Button size="icon" variant="ghost" className="size-6" onClick={() => onUpdateRoom(selectedRoom.id, { doors: selectedRoom.doors.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
              {/* Wall selector */}
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">Wall</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['top', 'right', 'bottom', 'left'] as const).map((w) => (
                    <button key={w} onClick={() => onUpdateRoom(selectedRoom.id, { doors: selectedRoom.doors.map((dd, j) => j === i ? { ...dd, wall: w } : dd) })} className={cn('text-[10px] py-1 rounded border capitalize', d.wall === w ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground')}>{w}</button>
                  ))}
                </div>
              </div>
              {/* Position slider */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Position along wall</span>
                  <span className="tech-num">{Math.round(d.pos * 100)}%</span>
                </div>
                <input type="range" min="0.05" max="0.95" step="0.05" value={d.pos} onChange={(e) => onUpdateRoom(selectedRoom.id, { doors: selectedRoom.doors.map((dd, j) => j === i ? { ...dd, pos: Number(e.target.value) } : dd) })} className="w-full" />
              </div>
              {/* Width */}
              <div>
                <span className="text-[10px] text-muted-foreground">Width (ft)</span>
                <Input type="number" step="0.5" min="2" value={d.width} onChange={(e) => onUpdateRoom(selectedRoom.id, { doors: selectedRoom.doors.map((dd, j) => j === i ? { ...dd, width: Number(e.target.value) } : dd) })} className="tech-num h-7 text-xs" />
              </div>
              {/* Swing direction */}
              <div>
                <span className="text-[10px] text-muted-foreground mb-1 block">Swing direction</span>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    { v: 'in-left', l: '↺ In-Left' },
                    { v: 'in-right', l: '↻ In-Right' },
                    { v: 'out-left', l: '↺ Out-Left' },
                    { v: 'out-right', l: '↻ Out-Right' },
                  ] as const).map((s) => (
                    <button key={s.v} onClick={() => onUpdateRoom(selectedRoom.id, { doors: selectedRoom.doors.map((dd, j) => j === i ? { ...dd, swing: s.v } : dd) })} className={cn('text-[10px] py-1.5 rounded border', d.swing === s.v ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground')}>{s.l}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1" onClick={() => onUpdateRoom(selectedRoom.id, { doors: [...selectedRoom.doors, { wall: 'top' as const, pos: 0.5, width: 3, swing: 'in-right' as const }] })}>
            <Plus className="size-3" /> Add Door
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ WINDOW TOOL ============
function WindowToolPanel(props: Props) {
  const { selectedRoom, onUpdateRoom } = props;
  if (!selectedRoom) {
    return <EmptyTool icon={AppWindow} title="Window Tool" subtitle="Select a room to add or edit its windows. Click on an outer wall to place a window." />;
  }
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={AppWindow} title="Windows" subtitle={selectedRoom.name} />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground mb-2">Windows on walls of <b>{selectedRoom.name}</b>.</p>
          {selectedRoom.windows.length === 0 && <p className="text-xs text-muted-foreground italic">No windows yet. Click a wall to add one.</p>}
          {selectedRoom.windows.map((w, i) => (
            <div key={i} className="p-2 rounded border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium capitalize">{w.wall} wall · window {i + 1}</span>
                <Button size="icon" variant="ghost" className="size-6" onClick={() => onUpdateRoom(selectedRoom.id, { windows: selectedRoom.windows.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Position along wall</span>
                  <span className="tech-num">{Math.round(w.pos * 100)}%</span>
                </div>
                <input type="range" min="0.1" max="0.9" step="0.05" value={w.pos} onChange={(e) => onUpdateRoom(selectedRoom.id, { windows: selectedRoom.windows.map((ww, j) => j === i ? { ...ww, pos: Number(e.target.value) } : ww) })} className="w-full" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Width (ft)</span>
                <Input type="number" step="0.5" min="2" value={w.width} onChange={(e) => onUpdateRoom(selectedRoom.id, { windows: selectedRoom.windows.map((ww, j) => j === i ? { ...ww, width: Number(e.target.value) } : ww) })} className="tech-num h-7 text-xs" />
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1" onClick={() => onUpdateRoom(selectedRoom.id, { windows: [...selectedRoom.windows, { wall: 'top', pos: 0.5, width: 4 }] })}>
            <Plus className="size-3" /> Add Window
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ STAIRS TOOL ============
function StairsToolPanel(props: Props) {
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={ArrowUpWideNarrow} title="Stairs Tool" subtitle="Add or edit staircase" />
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          <p className="text-xs text-muted-foreground">A staircase connects floors. Add a staircase room to enable vertical circulation.</p>
          <Button size="sm" className="w-full h-9 gap-1.5" onClick={() => props.onAddRoom?.('staircase')}>
            <ArrowUpWideNarrow className="size-4" /> Add Staircase Room
          </Button>
          <div className="p-3 rounded bg-muted/40 text-xs space-y-1">
            <p className="font-semibold">Staircase norms (India):</p>
            <p>• Width: 3 ft min, 3.5 ft preferred</p>
            <p>• Riser: 6-7", Tread: 10-12"</p>
            <p>• 10-12 steps per flight</p>
            <p>• Vastu: S, W, or SW; clockwise ascent</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ Shared ============
function PanelHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
      <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="size-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyTool({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={Icon} title={title} subtitle={subtitle} />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Icon className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Select a room first</p>
        </div>
      </div>
    </div>
  );
}
