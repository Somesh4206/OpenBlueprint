'use client';

import { LayoutData, RoomType } from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { cn } from '@/lib/utils';

interface Props {
  layout?: LayoutData;
  rooms?: { type: RoomType; w: number; l: number }[];
  className?: string;
  dark?: boolean;
  showLabels?: boolean;
}

// Lightweight SVG floor plan preview — used for thumbnails, template cards, hero
export function MiniPlan({ layout, rooms, className, dark = false, showLabels = true }: Props) {
  if (layout) {
    return <LayoutMini layout={layout} className={className} dark={dark} showLabels={showLabels} />;
  }
  if (rooms) {
    return <PackedMini rooms={rooms} className={className} dark={dark} showLabels={showLabels} />;
  }
  return null;
}

function LayoutMini({
  layout,
  className,
  dark,
  showLabels,
}: {
  layout: LayoutData;
  className?: string;
  dark: boolean;
  showLabels: boolean;
}) {
  const { plot } = layout;
  const padding = 6;
  const maxW = 240;
  const scale = (maxW - padding * 2) / plot.width;
  const W = plot.width * scale + padding * 2;
  const H = plot.length * scale + padding * 2;
  const stroke = dark ? '#7fb0e8' : '#2b4a7a';
  const grid = dark ? '#1d3a5c' : '#eef1f6';
  const text = dark ? '#dce8f7' : '#3a4658';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('block', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {Array.from({ length: Math.floor(plot.width / 4) + 1 }, (_, i) => i * 4).map((x) => (
        <line
          key={`v${x}`}
          x1={padding + x * scale}
          y1={padding}
          x2={padding + x * scale}
          y2={padding + plot.length * scale}
          stroke={grid}
          strokeWidth={0.5}
        />
      ))}
      {Array.from({ length: Math.floor(plot.length / 4) + 1 }, (_, i) => i * 4).map((y) => (
        <line
          key={`h${y}`}
          x1={padding}
          y1={padding + y * scale}
          x2={padding + plot.width * scale}
          y2={padding + y * scale}
          stroke={grid}
          strokeWidth={0.5}
        />
      ))}
      <rect
        x={padding}
        y={padding}
        width={plot.width * scale}
        height={plot.length * scale}
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
      />
      {layout.rooms.map((r) => {
        const cat = ROOM_CATALOG[r.type];
        const rx = padding + r.x * scale;
        const ry = padding + r.y * scale;
        const rw = r.width * scale;
        const rl = r.length * scale;
        return (
          <g key={r.id}>
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rl}
              fill={dark ? hexA(cat.accent, 0.22) : cat.color}
              stroke={stroke}
              strokeWidth={1}
            />
            {showLabels && rw > 28 && rl > 20 && (
              <text
                x={rx + rw / 2}
                y={ry + rl / 2 + 3}
                textAnchor="middle"
                fontSize={7}
                fontWeight={600}
                fill={text}
              >
                {r.name.slice(0, 12)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function PackedMini({
  rooms,
  className,
  dark,
  showLabels,
}: {
  rooms: { type: RoomType; w: number; l: number }[];
  className?: string;
  dark: boolean;
  showLabels: boolean;
}) {
  // simple stacked pack into a 100x80 canvas
  const canvasW = 100;
  const canvasH = 80;
  const stroke = dark ? '#7fb0e8' : '#2b4a7a';
  const grid = dark ? '#1d3a5c' : '#eef1f6';
  const text = dark ? '#dce8f7' : '#3a4658';
  const placed: { x: number; y: number; w: number; h: number; type: RoomType }[] = [];
  for (const r of rooms) {
    let placedOk = false;
    for (let y = 2; y + r.l <= canvasH - 2 && !placedOk; y += 4) {
      for (let x = 2; x + r.w <= canvasW - 2 && !placedOk; x += 4) {
        const overlaps = placed.some(
          (p) =>
            x < p.x + p.w - 1 &&
            x + r.w > p.x + 1 &&
            y < p.y + p.h - 1 &&
            y + r.l > p.y + 1,
        );
        if (!overlaps) {
          placed.push({ x, y, w: r.w, h: r.l, type: r.type });
          placedOk = true;
        }
      }
    }
    if (!placedOk) placed.push({ x: 2, y: 2, w: r.w, h: r.l, type: r.type });
  }
  return (
    <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className={cn('block', className)} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={canvasW} height={canvasH} fill={dark ? '#0f2742' : 'transparent'} />
      {Array.from({ length: 6 }, (_, i) => i * 20).map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={canvasH} stroke={grid} strokeWidth={0.3} />
      ))}
      {Array.from({ length: 5 }, (_, i) => i * 20).map((y) => (
        <line key={y} x1={0} y1={y} x2={canvasW} y2={y} stroke={grid} strokeWidth={0.3} />
      ))}
      <rect x={1} y={1} width={canvasW - 2} height={canvasH - 2} fill="none" stroke={stroke} strokeWidth={1} />
      {placed.map((r, i) => {
        const cat = ROOM_CATALOG[r.type];
        return (
          <g key={i}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill={dark ? hexA(cat.accent, 0.22) : cat.color}
              stroke={stroke}
              strokeWidth={0.8}
            />
            {showLabels && r.w > 16 && r.h > 12 && (
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 2} textAnchor="middle" fontSize={5} fontWeight={600} fill={text}>
                {cat.label.split(' ')[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
