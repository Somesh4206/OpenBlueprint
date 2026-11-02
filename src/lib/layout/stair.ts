// Staircase core: one flight per building, reserved at the same XY on every
// floor BEFORE rooms are packed, so it can never shift between floors.
// Sized for a 10 ft floor-to-floor height (~16 risers of 7.5 in).

import type { LayoutChoice, LayoutData, RoomRect, StairCore, ValidationIssue } from '../types';
import type { Rect } from './engine';

export const FLOOR_HEIGHT_FT = 10;

const DOG_LEG = { width: 7, length: 10 };
const STRAIGHT = { width: 3.5, length: 13 };
// Rooms beside the flight still need a usable width, and rooms in front of /
// behind it a usable depth — otherwise the stair "fits" but strands slivers.
const MIN_ROOM_ACROSS = { 'dog-leg': 10, straight: 8 } as const;
const MIN_ROOM_DEPTH = 8;
// Shared wall length that counts as a walk-in opening onto the flight.
const MIN_ACCESS_EDGE = 3;
// Common rooms the flight may open into (the upper Lobby is a foyer).
const ACCESS_TYPES = new Set<RoomRect['type']>(['foyer', 'living', 'dining']);
const EPS = 0.05;

const half = (n: number) => Math.round(n * 2) / 2;

/** Pick the flight for a footprint: dog-leg by default, straight when narrow. */
export function sizeStair(fp: Rect): { width: number; length: number; kind: StairCore['kind'] } | null {
  if (fp.w >= DOG_LEG.width + MIN_ROOM_ACROSS['dog-leg'] && fp.h >= DOG_LEG.length + MIN_ROOM_DEPTH) {
    return { ...DOG_LEG, kind: 'dog-leg' };
  }
  if (fp.w >= STRAIGHT.width + MIN_ROOM_ACROSS.straight && fp.h >= STRAIGHT.length + MIN_ROOM_DEPTH) {
    return { ...STRAIGHT, kind: 'straight' };
  }
  return null;
}

/**
 * Reserve the core inside `fp`. `frontOffset` is the distance from the road
 * edge to the flight's front edge (the entry band sits in front of it).
 * `fromHigh` is true when the road is at the footprint's high-y edge.
 */
export function reserveStair(
  fp: Rect,
  slot: LayoutChoice['stairSlot'],
  frontOffset: number,
  fromHigh: boolean,
): StairCore | null {
  const size = sizeStair(fp);
  if (!size) return null;
  if (frontOffset < 0 || frontOffset + size.length > fp.h + EPS) return null;
  const x =
    slot === 'left' ? fp.x : slot === 'right' ? fp.x + fp.w - size.width : half(fp.x + (fp.w - size.width) / 2);
  const y = fromHigh ? fp.y + fp.h - frontOffset - size.length : fp.y + frontOffset;
  return { x, y, width: size.width, length: size.length, kind: size.kind };
}

function sharedEdge(a: Rect, b: Rect): number {
  const alongY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const alongX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (Math.abs(a.x + a.w - b.x) < EPS || Math.abs(b.x + b.w - a.x) < EPS) return Math.max(0, alongY);
  if (Math.abs(a.y + a.h - b.y) < EPS || Math.abs(b.y + b.h - a.y) < EPS) return Math.max(0, alongX);
  return 0;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
}

function within(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS
  );
}

const floorName = (f: number) => (f === 0 ? 'the ground floor' : `floor ${f}`);
const issue = (code: string, message: string, roomName?: string): ValidationIssue => ({
  code, message, roomName, severity: 'error',
});

/**
 * Hard stair checks for multi-floor plans. `footprints[f]` (optional) is the
 * tiled footprint of floor f; when given, the core must sit inside every one.
 */
export function checkStair(layout: LayoutData, footprints?: Rect[]): ValidationIssue[] {
  if (layout.floors <= 1) return [];
  const core = layout.stair;
  if (!core) {
    // Legacy saved projects carry the stair as furniture on each lower floor.
    const legacy = Array.from({ length: layout.floors - 1 }, (_, f) => f).every((f) =>
      layout.furniture.some((it) => (it.type === 'staircase' || it.type === 'spiral-staircase') && it.floor === f),
    );
    return legacy ? [] : [issue('STAIR_MISSING', `This ${layout.floors}-floor plan has no staircase.`)];
  }

  const issues: ValidationIssue[] = [];
  const min = core.kind === 'dog-leg' ? DOG_LEG : STRAIGHT;
  if (core.width < min.width - EPS || core.length < min.length - EPS) {
    issues.push(issue(
      'STAIR_TOO_SMALL',
      `Staircase is ${core.width}×${core.length} ft; a ${core.kind} flight climbing ${FLOOR_HEIGHT_FT} ft needs at least ${min.width}×${min.length} ft.`,
    ));
  }

  const coreRect: Rect = { x: core.x, y: core.y, w: core.width, h: core.length };
  for (let f = 0; f < layout.floors; f++) {
    const fp = footprints?.[f];
    if (fp && !within(coreRect, fp)) {
      issues.push(issue(
        'STAIR_MISALIGNED',
        `Staircase falls outside ${floorName(f)}, so it cannot line up with the floors above and below.`,
      ));
      continue;
    }
    const rooms = layout.rooms.filter((r) => r.floor === f);
    const rects = rooms.map((r) => ({ r, rect: { x: r.x, y: r.y, w: r.width, h: r.length } }));
    for (const { r, rect } of rects) {
      if (overlaps(rect, coreRect)) {
        issues.push(issue('STAIR_BLOCKED', `${r.name} covers the staircase on ${floorName(f)}.`, r.name));
      }
    }
    const access = rects.some(({ r, rect }) => ACCESS_TYPES.has(r.type) && sharedEdge(rect, coreRect) >= MIN_ACCESS_EDGE);
    if (!access) {
      issues.push(issue(
        'STAIR_BAD_ACCESS',
        `On ${floorName(f)} the staircase does not open into a foyer, lobby, living or dining room.`,
      ));
    }
  }
  return issues;
}
