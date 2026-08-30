'use client';

import { cn } from '@/lib/utils';

/**
 * Lightweight isometric house illustration — pure SVG, no Three.js.
 * Used in the hero "3D View" tab to give a stylised architectural feel.
 * Uses a 30-degree isometric projection.
 */
export function IsometricHouse({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 280"
      className={cn('block', className)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Isometric house illustration"
    >
      {/* Ground shadow */}
      <ellipse cx="160" cy="240" rx="110" ry="18" fill="oklch(0.32 0.08 250 / 0.08)" />

      {/* === Plot slab (isometric) === */}
      <IsoRect
        x={50}
        y={170}
        w={220}
        d={120}
        fill="oklch(0.985 0.004 95)"
        stroke="oklch(0.32 0.08 250 / 0.5)"
        strokeW={1}
      />

      {/* Slab thickness — front-right face */}
      <path
        d={`M ${iso(270, 170)} L ${iso(270, 290)} L ${iso(50, 290)} L ${iso(50, 170)} Z`}
        fill="oklch(0.92 0.01 250)"
        stroke="oklch(0.32 0.08 250 / 0.4)"
        strokeWidth="0.8"
      />

      {/* === Ground floor (light) === */}
      <IsoBox
        x={60}
        y={170}
        w={140}
        d={100}
        h={36}
        fill="oklch(0.96 0.005 250)"
        stroke="oklch(0.32 0.08 250)"
        strokeW={1.2}
      />

      {/* === First floor (slightly tinted) === */}
      <IsoBox
        x={70}
        y={175}
        w={130}
        d={90}
        h={60}
        fill="oklch(1 0 0)"
        stroke="oklch(0.32 0.08 250)"
        strokeW={1.2}
      />

      {/* Roof slab */}
      <IsoBox
        x={68}
        y={173}
        w={134}
        d={94}
        h={6}
        fill="oklch(0.55 0.19 220 / 0.18)"
        stroke="oklch(0.55 0.19 220 / 0.6)"
        strokeW={1}
      />

      {/* Parapet on top */}
      <IsoBox
        x={70}
        y={175}
        w={130}
        d={90}
        h={4}
        fill="oklch(0.32 0.08 250 / 0.85)"
        stroke="oklch(0.32 0.08 250)"
        strokeW={0.8}
      />

      {/* Front windows on ground floor */}
      <IsoWindow x={75} y={178} w={20} h={26} face="front" />
      <IsoWindow x={100} y={178} w={20} h={26} face="front" />
      <IsoWindow x={125} y={178} w={20} h={26} face="front" />
      <IsoWindow x={160} y={178} w={30} h={26} face="front" />

      {/* Side window on ground floor */}
      <IsoWindow x={200} y={178} w={0} h={26} face="side" sideW={20} />

      {/* First floor windows */}
      <IsoWindow x={80} y={190} w={22} h={32} face="front-upper" />
      <IsoWindow x={108} y={190} w={22} h={32} face="front-upper" />
      <IsoWindow x={140} y={190} w={28} h={32} face="front-upper" />

      {/* Door (cyan accent) */}
      <IsoDoor x={175} y={178} w={18} h={32} />

      {/* Staircase to entrance */}
      <IsoBox
        x={195}
        y={176}
        w={16}
        d={6}
        h={4}
        fill="oklch(0.92 0.01 250)"
        stroke="oklch(0.32 0.08 250 / 0.6)"
        strokeW={0.8}
      />
      <IsoBox
        x={200}
        y={172}
        w={14}
        d={6}
        h={8}
        fill="oklch(0.92 0.01 250)"
        stroke="oklch(0.32 0.08 250 / 0.6)"
        strokeW={0.8}
      />

      {/* Car parking slab to the side */}
      <IsoBox
        x={210}
        y={200}
        w={50}
        d={70}
        h={2}
        fill="oklch(0.88 0.01 250)"
        stroke="oklch(0.32 0.08 250 / 0.4)"
        strokeW={0.8}
      />
      <IsoBox
        x={214}
        y={210}
        w={16}
        d={28}
        h={4}
        fill="oklch(0.62 0.19 220 / 0.25)"
        stroke="oklch(0.62 0.19 220)"
        strokeW={0.6}
      />

      {/* Tree */}
      <IsoTree x={255} y={190} />

      {/* Measurement labels */}
      <text
        x="160"
        y="265"
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="oklch(0.32 0.08 250)"
        className="tech-num"
      >
        30 × 40 ft
      </text>

      {/* North arrow (top-right) */}
      <g transform="translate(290, 30)">
        <circle cx="0" cy="0" r="14" fill="none" stroke="oklch(0.32 0.08 250 / 0.6)" strokeWidth="1" />
        <path d="M 0 -10 L 4 4 L 0 0 L -4 4 Z" fill="oklch(0.32 0.08 250)" />
        <text x="0" y="-15" textAnchor="middle" fontSize="7" fontWeight="700" fill="oklch(0.32 0.08 250)">
          N
        </text>
      </g>

      {/* Storey label */}
      <text
        x="45"
        y="50"
        fontSize="8"
        fontWeight="600"
        fill="oklch(0.5 0.015 260)"
        className="tech-num"
      >
        G+1 STOREY
      </text>
      <text
        x="45"
        y="62"
        fontSize="8"
        fontWeight="500"
        fill="oklch(0.5 0.015 260)"
      >
        Modern · 1,200 sq.ft
      </text>
    </svg>
  );
}

/* ---------- Isometric helpers ---------- */
// 30° isometric: x' = (x - y) * cos(30), y' = (x + y) * sin(30) - z
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);
const SCALE = 0.7;
function iso(x: number, y: number, z = 0): string {
  const px = (x - y) * COS30 * SCALE;
  const py = (x + y) * SIN30 * SCALE - z;
  return `${px.toFixed(2)},${py.toFixed(2)}`;
}

function IsoRect({
  x,
  y,
  w,
  d,
  fill,
  stroke,
  strokeW,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  fill: string;
  stroke: string;
  strokeW: number;
}) {
  const p1 = iso(x, y);
  const p2 = iso(x + w, y);
  const p3 = iso(x + w, y + d);
  const p4 = iso(x, y + d);
  return (
    <polygon
      points={`${p1} ${p2} ${p3} ${p4}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeW}
    />
  );
}

function IsoBox({
  x,
  y,
  w,
  d,
  h,
  fill,
  stroke,
  strokeW,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  fill: string;
  stroke: string;
  strokeW: number;
}) {
  // 8 corners
  const bottom = [iso(x, y, 0), iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x, y + d, 0)];
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  // We render only visible faces: top, front (y+d edge), right (x+w edge)
  return (
    <g>
      {/* Right face (x+w side) */}
      <polygon
        points={`${bottom[1]} ${bottom[2]} ${top[2]} ${top[1]}`}
        fill={shade(fill, -0.06)}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      {/* Front face (y+d side) */}
      <polygon
        points={`${bottom[2]} ${bottom[3]} ${top[3]} ${top[2]}`}
        fill={shade(fill, -0.12)}
        stroke={stroke}
        strokeWidth={strokeW}
      />
      {/* Top face */}
      <polygon
        points={`${top[0]} ${top[1]} ${top[2]} ${top[3]}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
      />
    </g>
  );
}

function IsoWindow({
  x,
  y,
  w,
  h,
  face,
  sideW,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  face: 'front' | 'front-upper' | 'side';
  sideW?: number;
}) {
  if (face === 'side') {
    // Window on the right face (x+w side) — drawn as a parallelogram
    const sw = sideW ?? 14;
    const p1 = iso(x + 130, y, 6);
    const p2 = iso(x + 130, y + sw, 6);
    const p3 = iso(x + 130, y + sw, 6 + h);
    const p4 = iso(x + 130, y, 6 + h);
    return (
      <polygon
        points={`${p1} ${p2} ${p3} ${p4}`}
        fill="oklch(0.62 0.19 220 / 0.35)"
        stroke="oklch(0.32 0.08 250 / 0.7)"
        strokeWidth="0.8"
      />
    );
  }
  // Front face window — along y+d (y + 100) edge, raised by z
  const z = face === 'front-upper' ? 40 : 0;
  const yy = y + 100;
  const p1 = iso(x, yy, z + 4);
  const p2 = iso(x + w, yy, z + 4);
  const p3 = iso(x + w, yy, z + 4 + h);
  const p4 = iso(x, yy, z + 4 + h);
  return (
    <polygon
      points={`${p1} ${p2} ${p3} ${p4}`}
      fill="oklch(0.62 0.19 220 / 0.3)"
      stroke="oklch(0.32 0.08 250 / 0.8)"
      strokeWidth="0.8"
    />
  );
}

function IsoDoor({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const yy = y + 100;
  const p1 = iso(x, yy, 0);
  const p2 = iso(x + w, yy, 0);
  const p3 = iso(x + w, yy, h);
  const p4 = iso(x, yy, h);
  return (
    <polygon
      points={`${p1} ${p2} ${p3} ${p4}`}
      fill="oklch(0.62 0.19 220 / 0.55)"
      stroke="oklch(0.32 0.08 250)"
      strokeWidth="1"
    />
  );
}

function IsoTree({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon
        points={`${iso(x, y, 0)} ${iso(x + 4, y, 0)} ${iso(x + 4, y, 18)} ${iso(x, y, 18)}`}
        fill="oklch(0.4 0.05 250)"
      />
      <ellipse
        cx={(parseFloat(iso(x + 2, y + 2, 30).split(',')[0]) + parseFloat(iso(x + 2, y - 2, 30).split(',')[0])) / 2}
        cy={parseFloat(iso(x + 2, y, 30).split(',')[1])}
        rx="14"
        ry="10"
        fill="oklch(0.55 0.18 160 / 0.6)"
        stroke="oklch(0.4 0.15 160 / 0.8)"
        strokeWidth="0.8"
      />
    </g>
  );
}

function shade(oklch: string, delta: number): string {
  // Tiny helper to slightly darken/lighten an oklch color string of form "oklch(L C H)" or "oklch(L C H / A)"
  const m = oklch.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/);
  if (!m) return oklch;
  const l = Math.max(0, Math.min(1, parseFloat(m[1]) + delta));
  const a = m[4] ? ` / ${m[4]}` : '';
  return `oklch(${l.toFixed(3)} ${m[2]} ${m[3]}${a})`;
}
