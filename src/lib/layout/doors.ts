// Deterministic door + window solver.
// Replaces the old random placement (center-facing wall + Math.random).
//
// Principles:
//  - Doors connect rooms that SHOULD be connected (circulation graph +
//    actual shared walls), placed at the center of the shared wall segment.
//  - Entry door: foyer/living on the road-side wall.
//  - Parking: wide shutter opening on the road-side wall.
//  - Bathrooms never open directly into living/dining/kitchen — their door
//    goes on a wall shared with a bedroom/corridor room, else an interior wall.
//  - Bedrooms never get doors on walls shared with parking.
//  - Fully deterministic: offset derived from room id hash, no Math.random.

import { DoorMarker, PlotConfig, RoomRect, RoomType, WindowMarker } from '../types';
import { areAdjacent } from '../architecture/rules';

type Wall = DoorMarker['wall'];

const OPPOSITE: Record<Wall, Wall> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000; // 0..1
}

/** Shared wall segment between two adjacent rooms, from `room`'s perspective. */
function sharedWall(a: RoomRect, b: RoomRect, tol = 0.6): { wall: Wall; center: number } | null {
  // b is to the right of a → a's 'right' wall
  if (Math.abs(a.x + a.width - b.x) < tol && overlap(a.y, a.length, b.y, b.length) > 1.5) {
    return { wall: 'right', center: clamp01((overlapCenter(a.y, a.length, b.y, b.length) - a.y) / a.length) };
  }
  if (Math.abs(b.x + b.width - a.x) < tol && overlap(a.y, a.length, b.y, b.length) > 1.5) {
    return { wall: 'left', center: clamp01((overlapCenter(a.y, a.length, b.y, b.length) - a.y) / a.length) };
  }
  // b is below a (y-down coords: higher y = further down) → a's 'bottom' wall
  if (Math.abs(a.y + a.length - b.y) < tol && overlap(a.x, a.width, b.x, b.width) > 1.5) {
    return { wall: 'bottom', center: clamp01((overlapCenter(a.x, a.width, b.x, b.width) - a.x) / a.width) };
  }
  if (Math.abs(b.y + b.length - a.y) < tol && overlap(a.x, a.width, b.x, b.width) > 1.5) {
    return { wall: 'top', center: clamp01((overlapCenter(a.x, a.width, b.x, b.width) - a.x) / a.width) };
  }
  return null;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a0 + a1, b0 + b1) - Math.max(a0, b0);
}
function overlapCenter(a0: number, a1: number, b0: number, b1: number): number {
  return (Math.max(a0, b0) + Math.min(a0 + a1, b0 + b1)) / 2;
}
function clamp01(n: number): number {
  return Math.round(Math.min(0.75, Math.max(0.25, n)) * 100) / 100;
}

/** Which room types should a room connect to, in priority order. */
function desiredNeighbors(type: RoomType): RoomType[] {
  switch (type) {
    case 'kitchen': return ['dining', 'living', 'foyer'];
    case 'dining': return ['kitchen', 'living', 'foyer'];
    case 'living': return ['foyer', 'dining', 'kitchen'];
    case 'foyer': return ['living', 'dining'];
    case 'bedroom': return ['bathroom', 'foyer', 'living', 'dining'];
    case 'bathroom': return ['bedroom', 'foyer', 'office'];
    case 'pooja': return ['living', 'dining', 'foyer', 'bedroom'];
    case 'office': return ['living', 'foyer', 'bedroom'];
    case 'store': return ['kitchen', 'dining'];
    case 'utility': return ['kitchen', 'bathroom', 'foyer'];
    case 'balcony': return ['bedroom', 'living', 'dining'];
    case 'staircase': return ['living', 'foyer', 'dining'];
    default: return ['living', 'foyer', 'dining'];
  }
}

function roadWall(plot: PlotConfig): Wall {
  switch (plot.roadSide) {
    case 'south': return 'bottom';
    case 'north': return 'top';
    case 'east': return 'right';
    case 'west': return 'left';
  }
}

function isOnRoadSide(r: RoomRect, plot: PlotConfig, tol = 0.6): boolean {
  switch (plot.roadSide) {
    case 'south': return Math.abs(r.y + r.length - plot.length) < tol;
    case 'north': return Math.abs(r.y) < tol;
    case 'east': return Math.abs(r.x + r.width - plot.width) < tol;
    case 'west': return Math.abs(r.x) < tol;
  }
}

/**
 * Assign doors + windows to every room on one floor.
 * Mutates nothing — returns fresh marker arrays per room id.
 */
export function solveOpenings(
  floorRooms: RoomRect[],
  plot: PlotConfig,
): Map<string, { doors: DoorMarker[]; windows: WindowMarker[] }> {
  const out = new Map<string, { doors: DoorMarker[]; windows: WindowMarker[] }>();
  const byId = new Map(floorRooms.map((r) => [r.id, r]));
  const usedWalls = new Map<string, Set<Wall>>();

  const take = (id: string, wall: Wall): boolean => {
    let s = usedWalls.get(id);
    if (!s) { s = new Set(); usedWalls.set(id, s); }
    if (s.has(wall)) return false;
    s.add(wall);
    return true;
  };

  // adjacency cache
  const adj = new Map<string, RoomRect[]>();
  for (const r of floorRooms) {
    adj.set(r.id, floorRooms.filter((o) => o.id !== r.id && areAdjacent(r, o)));
  }

  for (const room of floorRooms) {
    const doors: DoorMarker[] = [];
    // Content hash (NOT the id — ids embed Date.now). Same plan → same doors.
    const key = `${room.name}|${room.type}|${room.floor}|${room.x}|${room.y}|${room.width}|${room.length}`;
    const jitter = (hash01(key) - 0.5) * 0.1; // ±0.05 deterministic

    if (room.type === 'parking') {
      // Wide vehicle shutter on the road side.
      doors.push({ wall: roadWall(plot), pos: 0.5, width: 10, swing: 'out-right' });
      out.set(room.id, { doors, windows: [] });
      continue;
    }
    if (room.type === 'staircase') {
      // Open stairwell — no doors.
      out.set(room.id, { doors, windows: [] });
      continue;
    }

    const neighbors = adj.get(room.id) || [];
    const prefs = desiredNeighbors(room.type);

    // 1. Entry door for foyer/living touching the road.
    if ((room.type === 'foyer' || room.type === 'living') && isOnRoadSide(room, plot)) {
      const w = roadWall(plot);
      if (take(room.id, w)) doors.push({ wall: w, pos: 0.5, width: 3.5, swing: 'out-right' });
    }

    // 2. Interior door to the best preferred neighbor sharing a wall.
    //    Bathrooms skip living/dining/kitchen neighbors (privacy rule).
    //    Bedrooms skip parking neighbors (noise/fume rule).
    let connected = false;
    for (const want of prefs) {
      const cand = neighbors.filter((n) => n.type === want);
      // rule filters
      const filtered = cand.filter((n) => {
        if (room.type === 'bathroom' && (n.type === 'living' || n.type === 'dining' || n.type === 'kitchen')) return false;
        if (room.type === 'bedroom' && n.type === 'parking') return false;
        if (n.type === 'parking') return false;
        if (n.type === 'bathroom' && (room.type === 'living' || room.type === 'dining' || room.type === 'kitchen')) return false;
        return true;
      });
      // prefer the neighbor with the longest shared segment
      filtered.sort((a, b) => sharedLen(room, b) - sharedLen(room, a));
      for (const n of filtered) {
        const s = sharedWall(room, n);
        if (!s) continue;
        if (!take(room.id, s.wall)) continue;
        // Mirror the door on the neighbor if it has no door to us yet.
        // Cap mirrored rooms at 2 doors — 3+ doors reads as "passage" (Rule 7).
        const ns = OPPOSITE[s.wall];
        const nDoors = out.get(n.id)?.doors;
        const neighborHas = nDoors?.some((d) => d.wall === ns) || (nDoors && nDoors.length >= 2);
        doors.push({
          wall: s.wall,
          pos: clamp01(s.center + jitter),
          width: room.type === 'living' || room.type === 'dining' ? 3.5 : 3,
          swing: s.center < 0.5 ? 'in-right' : 'in-left',
        });
        if (!neighborHas && n.type !== 'parking') {
          const entry = out.get(n.id);
          if (entry) {
            if (take(n.id, ns)) {
              entry.doors.push({ wall: ns, pos: clamp01(1 - s.center - jitter), width: 3, swing: 'in-right' });
            }
          }
        }
        connected = true;
        break;
      }
      if (connected) break;
    }

    // 3. Fallback: any non-prohibited neighbor.
    if (!connected) {
      const fallback = neighbors
        .filter((n) => n.type !== 'parking')
        .filter((n) => !(room.type === 'bedroom' && n.type === 'parking'))
        .filter((n) => !(room.type === 'bathroom' && (n.type === 'living' || n.type === 'dining')))
        .sort((a, b) => sharedLen(room, b) - sharedLen(room, a));
      for (const n of fallback) {
        const s = sharedWall(room, n);
        if (!s) continue;
        if (!take(room.id, s.wall)) continue;
        doors.push({ wall: s.wall, pos: clamp01(s.center + jitter), width: 3, swing: 'in-right' });
        connected = true;
        break;
      }
    }

    // 4. Last resort: any free wall — but NEVER one shared with a
    // prohibited neighbor (a bathroom door must not open into living).
    if (!connected) {
      const banned = new Set<Wall>();
      for (const n of neighbors) {
        if (opensIntoProhibited(room.type, n.type)) {
          const s = sharedWall(room, n);
          if (s) banned.add(s.wall);
        }
      }
      const walls: Wall[] = ['top', 'bottom', 'left', 'right'];
      const rw = roadWall(plot);
      const ordered = walls.sort((a, b) => {
        const score = (w: Wall) => (w === rw ? 2 : 0) + (banned.has(w) ? 10 : 0);
        return score(a) - score(b);
      });
      for (const w of ordered) {
        if (take(room.id, w)) {
          doors.push({ wall: w, pos: 0.5, width: 2.8, swing: 'in-right' });
          break;
        }
      }
    }

    out.set(room.id, { doors, windows: solveWindows(room, plot, byId) });
  }

  return out;
}

/**
 * True when a door from `from` into `to` would violate privacy/hygiene rules.
 * Shared walls are fine (insulation) — OPENING into these rooms is not.
 */
export function opensIntoProhibited(from: RoomType, to: RoomType): boolean {
  if (from === 'bathroom' && (to === 'living' || to === 'dining' || to === 'kitchen')) return true;
  if (to === 'bathroom' && (from === 'living' || from === 'dining' || from === 'kitchen')) return true;
  if ((from === 'kitchen' && to === 'bathroom') || (from === 'bathroom' && to === 'kitchen')) return true;
  if (from === 'bedroom' && to === 'parking') return true;
  return false;
}

/** Wall of `a` shared with `b`, if any. Exported for the validator. */
export function sharedWallOf(a: RoomRect, b: RoomRect): Wall | null {
  return sharedWall(a, b)?.wall ?? null;
}

export interface SwingRect { x: number; y: number; w: number; h: number; }

/**
 * Floor-space rectangles each door needs to swing + be walked through
 * (~3.5ft square inside the room at the door position). Furniture must
 * stay out of these — a counter under a door arc is the reported bug.
 */
const SWING = 3.5; // door swing + walk-through clearance (ft)

/** Swing rect for a single door at a given normalized position. */
export function swingRectFor(room: RoomRect, wall: Wall, pos: number): SwingRect {
  const S = SWING;
  if (wall === 'top') {
    const cx = room.x + pos * room.width;
    return { x: cx - S / 2, y: room.y, w: S, h: S };
  } else if (wall === 'bottom') {
    const cx = room.x + pos * room.width;
    return { x: cx - S / 2, y: room.y + room.length - S, w: S, h: S };
  } else if (wall === 'left') {
    const cy = room.y + pos * room.length;
    return { x: room.x, y: cy - S / 2, w: S, h: S };
  }
  const cy = room.y + pos * room.length;
  return { x: room.x + room.width - S, y: cy - S / 2, w: S, h: S };
}

export function doorSwingRects(room: RoomRect): SwingRect[] {
  return room.doors.map((d) => swingRectFor(room, d.wall, d.pos));
}

/** Rect overlap test (local — avoids an engine import cycle). */
export function rectsTouch(a: SwingRect, b: SwingRect, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

function sharedLen(a: RoomRect, b: RoomRect): number {
  const v = Math.abs(a.x + a.width - b.x) < 0.7 || Math.abs(b.x + b.width - a.x) < 0.7
    ? overlap(a.y, a.length, b.y, b.length) : 0;
  const h = Math.abs(a.y + a.length - b.y) < 0.7 || Math.abs(b.y + b.length - a.y) < 0.7
    ? overlap(a.x, a.width, b.x, b.width) : 0;
  return Math.max(v, h);
}

function solveWindows(room: RoomRect, plot: PlotConfig, _byId: Map<string, RoomRect>): WindowMarker[] {
  if (room.type === 'parking' || room.type === 'store' || room.type === 'utility' || room.type === 'staircase') return [];
  const outer: Wall[] = [];
  if (room.y <= 0.6) outer.push('top');
  if (room.y + room.length >= plot.length - 0.6) outer.push('bottom');
  if (room.x <= 0.6) outer.push('left');
  if (room.x + room.width >= plot.width - 0.6) outer.push('right');
  if (outer.length === 0) return [];
  // Bedrooms + living get up to 2 windows (cross-ventilation); others 1.
  const count = room.type === 'bedroom' || room.type === 'living' ? Math.min(2, outer.length) : 1;
  const h = hash01(`${room.name}|${room.type}|${room.floor}|${room.x}|${room.y}w`);
  return outer.slice(0, count).map((wall, i) => ({
    wall,
    pos: clamp01(0.35 + h * 0.2 + i * 0.15),
    width: room.type === 'living' ? 5 : 4,
  }));
}
