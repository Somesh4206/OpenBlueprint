'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, furnitureByCategory } from '@/lib/furniture-catalog';
import { FurnitureSymbol } from './furniture-symbol';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Sofa, Search, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface Props {
  onDropFurniture?: (type: string, x: number, y: number) => void;
}

export function FurnitureLibrary({ onDropFurniture }: Props) {
  const open = useApp((s) => s.furniturePanelOpen);
  const setOpen = useApp((s) => s.setFurniturePanelOpen);
  const category = useApp((s) => s.furnitureCategory);
  const setCategory = useApp((s) => s.setFurnitureCategory);
  const addFurniture = useApp((s) => s.addFurniture);
  const [search, setSearch] = useState('');

  const items = search
    ? FURNITURE_CATALOG.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : furnitureByCategory(category);

  function handleDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/x-furniture-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleQuickAdd(type: string) {
    // add at center of current floor's buildable area (approx)
    const layout = useApp.getState().currentLayout;
    if (layout) {
      const x = layout.plot.width / 2 - 3;
      const y = layout.plot.length / 2 - 3;
      addFurniture(type as never, x, y);
    }
  }

  return (
    <div className="border-r border-border bg-card flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors w-full"
      >
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Sofa className="size-3.5 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Furniture Library</p>
            <p className="text-[10px] text-muted-foreground">Drag onto plan</p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="flex flex-col h-full min-h-0">
          {/* Search */}
          <div className="px-3 pb-2 relative">
            <Search className="size-3.5 absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search furniture..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div className="flex gap-1 px-2 pb-2 overflow-x-auto scroll-thin">
              {FURNITURE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-md whitespace-nowrap font-medium transition-colors',
                    category === c.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Items grid */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-2 p-3">
              {items.map((f) => (
                <div
                  key={f.type}
                  draggable
                  onDragStart={(e) => handleDragStart(e, f.type)}
                  onDoubleClick={() => handleQuickAdd(f.type)}
                  className="group cursor-grab active:cursor-grabbing rounded-md border border-border bg-background hover:border-primary/40 hover:shadow-sm transition-all p-2 flex flex-col items-center gap-1"
                  title={`${f.name} — drag to canvas or double-click to add`}
                >
                  <div className="w-full aspect-square bg-muted/30 rounded p-1 flex items-center justify-center">
                    <FurnitureSymbol type={f.type} color={f.color} className="w-full h-full" />
                  </div>
                  <p className="text-[10px] font-medium text-center leading-tight line-clamp-2">{f.name}</p>
                  <p className="text-[9px] text-muted-foreground tech-num">{f.width}×{f.length}'</p>
                  {f.price && (
                    <p className="text-[9px] text-primary tech-num">₹{f.price.toLocaleString('en-IN')}</p>
                  )}
                </div>
              ))}
            </div>
            {items.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <Package className="size-6 mx-auto mb-2 opacity-40" />
                No furniture found
              </div>
            )}
          </ScrollArea>

          {/* Hint */}
          <div className="p-2 border-t border-border bg-muted/20">
            <p className="text-[9px] text-muted-foreground text-center leading-tight">
              Drag items onto the floor plan, or double-click to add at center.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
