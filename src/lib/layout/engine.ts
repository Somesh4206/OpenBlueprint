import {
  LayoutChoice,
  LayoutData,
  PlotConfig,
  ProjectConfig,
  RoomRect,
  RoomRequirement,
  ScoredLayout,
  DoorMarker,
  WindowMarker,
} from '../types';
import { CAPPED_TYPES, ROOM_CATALOG } from '../room-catalog';
import { scoreLayout } from './scoring';
import { validateLayout } from './validation';
import { assignBands, countCapViolations, MIN_BAND_DEPTH, optimizeAdjacencies, packRooms, placeZoneRooms } from '../architecture/planner';
import { sharedWallOverlap } from '../architecture/rules';
import { normalizeRequirements } from '../architecture/normalize';
import { doorSwingRects, opensIntoProhibited, sharedWallOf, solveOpenings, swingRectFor } from './doors';

/**
 * Validity beats aesthetics: while the REAL validator reports hard errors on
 * a floor (bedroom↔parking, isolated kitchen, bath opening into living… —
 * common when bands/zones merge on tight plots), try pairwise rect swaps and
 * keep strict improvements. Swapping permutes the tile set, so the floor
 * stays exactly tiled (no void, no overlap) by construction. Deterministic:
 * fixed pair order, strict improvement, max 2 rounds. Parking never moves.
 */
function repairGeometry(
  config: ProjectConfig,
  allRooms: RoomRect[],
  floor: number,
  groupOf?: (id: string) => string,
): void {
  const others = allRooms.filter((r) => r.floor !== floor);
  const live = allRooms.filter((r) => r.floor === floor);
  if (live.length < 2) return;

  const solve = (rs: RoomRect[]) => {
    const openings = solveOpenings(rs.filter((r) => r.type !== 'parking'), config.plot);
    for (const r of rs) {
      if (r.type === 'parking') continue;
      const o = openings.get(r.id);
      if (o) {
        r.doors = o.doors;
        r.windows = o.windows;
      }
    }
    repairProhibitedDoors(rs);
  };
  // Diagnosis score: hard errors dominate; then ballooning (a lone room
  // filling its band — dining as big as parking, kitchen past living),
  // then plain warnings. Swaps only permute rects, so tiling/void/overlap
  // can never regress — only the score decides.
  const diagScore = (rs: RoomRect[]) => {
    const v = validateLayout(
      { plot: config.plot, floors: config.floors, rooms: [...others, ...rs], furniture: [] },
      config,
    );
    let balloon = 0;
    const living = rs.find((r) => r.type === 'living');
    const livingArea = living ? living.width * living.length : 0;
    for (const r of rs) {
      if (r.type === 'parking' || r.type === 'living') continue;
      const pref = prefAreaOfType(config, r.type);
      const area = r.width * r.length;
      if (pref > 0 && area > pref * 2.8) balloon += (area / pref - 2.8) * 100;
      if (livingArea > 0 && (r.type === 'kitchen' || r.type === 'dining') && area > livingArea) balloon += 500;
    }
    return v.errors.length * 10000 + Math.round(balloon) + v.warnings.length;
  };

  const clone = (rs: RoomRect[]): RoomRect[] =>
    rs.map((r) => ({ ...r, doors: r.doors.map((d) => ({ ...d })), windows: r.windows.map((w) => ({ ...w })) }));

  let best = clone(live);
  solve(best);
  let bestScore = diagScore(best);
  if (bestScore < 1000) {
    writeBack(live, best);
    return;
  }

  // Runs while hard errors remain OR ballooning is severe (>= 200 ~ a room
  // at ~5x pref or a kitchen/dining past living). Pure-warning polishing
  // below that would churn good layouts, so stop there.
  // BEST-improvement (scan all pairs, take the single best swap): greedy
  // first-improvement gets trapped — e.g. it crushed a bedroom to 8×4
  // fixing an isolation error that a different swap fixed cleanly.
  const needsWork = (s: number) => s >= 10000 || s >= 200;
  for (let round = 0; round < 3 && needsWork(bestScore); round++) {
    let roundBest: RoomRect[] | null = null;
    for (let i = 0; i < best.length; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const a = best[i], b = best[j];
        if (a.type === 'parking' || b.type === 'parking') continue;
        // Swaps stay inside one pack group (porch or a single band strip):
        // cross-group swaps teleport rooms across bands and break tiling.
        if (groupOf && groupOf(a.id) !== groupOf(b.id)) continue;
        // Repairs must not manufacture cap violations to fix other errors:
        // swapping living into a 4ft slot trades a door error for an aspect
        // error and reads as a fix by raw counts. Block worsening only —
        // swaps that reduce cap violations still proceed.
        const beforeCaps = countCapViolations([a, b]);
        const afterCaps = countCapViolations([
          { type: a.type, width: b.width, length: b.length },
          { type: b.type, width: a.width, length: a.length },
        ]);
        if (afterCaps > beforeCaps) continue;
        const trial = clone(best);
        const ta = trial[i], tb = trial[j];
        // swap rects (positions + sizes)
        const rx = ta.x, ry = ta.y, rw = ta.width, rl = ta.length;
        ta.x = tb.x; ta.y = tb.y; ta.width = tb.width; ta.length = tb.length;
        tb.x = rx; tb.y = ry; tb.width = rw; tb.length = rl;
        solve(trial);
        const s = diagScore(trial);
        if (s < bestScore && (!roundBest || s < diagScore(roundBest))) {
          roundBest = trial;
        }
      }
    }
    if (!roundBest) break;
    best = roundBest;
    bestScore = diagScore(best);
  }
  writeBack(live, best);
}

/** Foyer-connectivity repair (mirrors the validator BFS). Adds paired doors
 * from each unvisited room to an adjacent visited room until fixpoint.
 * Bedrooms are destinations, never transit. Parking is skipped. */
function ensureConnectivity(allRooms: RoomRect[], floor: number): void {
  const rooms = allRooms.filter((r) => r.floor === floor);
  const foyers = rooms.filter((r) => r.type === 'foyer');
  if (foyers.length === 0) return;
  const edge = (a: RoomRect, b: RoomRect): boolean => {
    const w = sharedWallOf(a, b);
    if (!w) return false;
    if (a.doors.some((d) => d.wall === w)) return true;
    const ow = OPPOSITE_WALL[w];
    return b.doors.some((d) => d.wall === ow);
  };
  const visited = new Set<string>(foyers.map((f) => f.id));
  const queue = [...foyers];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const o of rooms) {
      if (o.id === cur.id || visited.has(o.id)) continue;
      if (edge(cur, o)) {
        visited.add(o.id);
        if (o.type !== 'bedroom') queue.push(o);
      }
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rooms) {
      if (r.type === 'parking' || visited.has(r.id)) continue;
      const host = rooms.find((o) => visited.has(o.id) && sharedWallOf(r, o) !== null);
      if (!host) continue;
      const wall = sharedWallOf(r, host)!;
      const ow = OPPOSITE_WALL[wall];
      if (!r.doors.some((d) => d.wall === wall)) {
        r.doors.push({ wall, pos: 0.5, width: 3, swing: 'in-right' });
      }
      if (!host.doors.some((d) => d.wall === ow)) {
        host.doors.push({ wall: ow, pos: 0.5, width: 3, swing: 'in-right' });
      }
      visited.add(r.id);
      if (r.type !== 'bedroom') queue.push(r);
      // Drain the queue again: newly visited non-bedrooms unlock neighbors.
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const o of rooms) {
          if (o.id === cur.id || visited.has(o.id)) continue;
          if (edge(cur, o)) {
            visited.add(o.id);
            if (o.type !== 'bedroom') queue.push(o);
          }
        }
      }
      changed = true;
    }
  }
}

function writeBack(live: RoomRect[], best: RoomRect[]): void {
  const byId = new Map(best.map((r) => [r.id, r]));
  for (const r of live) {
    const s = byId.get(r.id);
    if (!s) continue;
    r.x = s.x; r.y = s.y; r.width = s.width; r.length = s.length;
    r.doors = s.doors; r.windows = s.windows;
  }
}

type Wall = DoorMarker['wall'];

/**
 * Repair pass: if a room's door sits on a wall shared with a prohibited
 * neighbor (e.g. powder room wedged among public rooms with its door
 * opening into dining), move that door to the best free wall — preferring
 * walls shared with allowed neighbors, then outer walls. A moved door is
 * always better than a Rule 2 error.
 */
function repairProhibitedDoors(rooms: RoomRect[]): void {
  for (const r of rooms) {
    if (r.type === 'parking' || r.type === 'staircase' || r.doors.length === 0) continue;
    const sameFloor = rooms.filter((o) => o.id !== r.id && o.floor === r.floor);
    for (const o of sameFloor) {
      if (!opensIntoProhibited(r.type, o.type)) continue;
      const overlap = sharedWallOverlap(r, o);
      if (!overlap) continue;
      // Segment-aware trigger: only a door whose span intersects the shared
      // segment opens into the neighbor (a door over the foyer part of a
      // wall also shared with living is fine).
      const wallLen = overlap.wall === 'top' || overlap.wall === 'bottom' ? r.width : r.length;
      const di = r.doors.findIndex((d) => {
        if (d.wall !== overlap.wall) return false;
        const half = d.width / 2 / Math.max(0.5, wallLen);
        return d.pos + half > overlap.lo && d.pos - half < overlap.hi;
      });
      if (di < 0) continue;
      const banned = new Set<Wall>();
      for (const n of sameFloor) {
        if (opensIntoProhibited(r.type, n.type)) {
          const w = sharedWallOf(r, n);
          if (w) banned.add(w);
        }
      }
      const taken = new Set(r.doors.map((d) => d.wall));
      const walls: Wall[] = ['top', 'bottom', 'left', 'right'];
      const rank = (w: Wall) => {
        if (banned.has(w) || taken.has(w)) return 99;
        const sharedWith = sameFloor.some((n) => sharedWallOf(r, n) === w);
        return sharedWith ? 0 : 1; // prefer walls shared with allowed neighbors
      };
      const best = [...walls].sort((a, b) => rank(a) - rank(b))[0];
      if (best && rank(best) < 99) {
        r.doors[di] = { ...r.doors[di], wall: best, pos: 0.5 };
      }
    }
  }
}
import type { AIPlan, RoomPlacement } from '../ai/blueprint-planner';

export { scoreLayout, validateLayout };

// local id generator. During generation the seed is pinned so the same
// config + choice always yields byte-identical ids (determinism).
let _idCounter = 0;
let _idSeed: string | null = null;
export function genId(prefix = 'r'): string {
  _idCounter += 1;
  return `${prefix}${_idSeed ?? Date.now().toString(36)}${_idCounter}`;
}
/** Pin the id seed for one deterministic generation pass. */
export function beginSeededIds(seed: string): void {
  _idSeed = seed;
  _idCounter = 0;
}
export function endSeededIds(): void {
  _idSeed = null;
}
export function hashSeed(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ---- Geometry helpers ----
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - 0.01 &&
    a.x + a.w > b.x + 0.01 &&
    a.y < b.y + b.h - 0.01 &&
    a.y + a.h > b.y + 0.01
  );
}

export function rectWithin(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - 0.01 &&
    inner.y >= outer.y - 0.01 &&
    inner.x + inner.w <= outer.x + outer.w + 0.01 &&
    inner.y + inner.h <= outer.y + outer.h + 0.01
  );
}

export function areaOf(r: Rect): number {
  return r.w * r.h;
}

export function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---- Requirement expansion ----
// Expands a count-based requirement into individual room instances.
// For bedrooms: the FIRST instance is automatically named "Master Bedroom"
// (larger, with attached bathroom preference), subsequent ones are "Bedroom 1", "Bedroom 2", etc.
export function expandRequirements(reqs: RoomRequirement[]): RoomRequirement[] {
  const out: RoomRequirement[] = [];
  for (const r of reqs) {
    for (let i = 0; i < (r.count || 1); i++) {
      let name = r.name;
      let preferredWidth = r.preferredWidth;
      let preferredLength = r.preferredLength;
      let minWidth = r.minWidth;
      let minLength = r.minLength;

      if (r.type === 'bedroom') {
        if (i === 0) {
          // First bedroom = Master Bedroom (slightly larger)
          name = 'Master Bedroom';
          preferredWidth = Math.max(preferredWidth, 12);
          preferredLength = Math.max(preferredLength, 14);
          minWidth = Math.max(minWidth, 11);
          minLength = Math.max(minLength, 13);
        } else {
          name = `Bedroom ${i}`;
        }
      } else if (r.count > 1) {
        name = `${r.name} ${i + 1}`;
      }

      out.push({
        ...r,
        name,
        preferredWidth,
        preferredLength,
        minWidth,
        minLength,
      });
    }
  }
  return out;
}

// ---- Buildable rectangle (plot minus setbacks) ----
export function buildableArea(plot: PlotConfig, _floor?: number): Rect {
  switch (plot.roadSide) {
    case 'north':
      return {
        x: plot.setbackSides,
        y: plot.setbackFront,
        w: Math.max(0, plot.width - plot.setbackSides * 2),
        h: Math.max(0, plot.length - (plot.setbackFront + plot.setbackRear)),
      };
    case 'east':
      return {
        x: plot.setbackRear,
        y: plot.setbackSides,
        w: Math.max(0, plot.width - (plot.setbackFront + plot.setbackRear)),
        h: Math.max(0, plot.length - plot.setbackSides * 2),
      };
    case 'west':
      return {
        x: plot.setbackFront,
        y: plot.setbackSides,
        w: Math.max(0, plot.width - (plot.setbackFront + plot.setbackRear)),
        h: Math.max(0, plot.length - plot.setbackSides * 2),
      };
    case 'south':
    default:
      return {
        x: plot.setbackSides,
        y: plot.setbackRear,
        w: Math.max(0, plot.width - plot.setbackSides * 2),
        h: Math.max(0, plot.length - (plot.setbackFront + plot.setbackRear)),
      };
  }
}

// Tiled footprint for a floor: the buildable area, except upper floors sit
// on the ground load-bearing band when ground parking is carved (no
// habitable cantilever). Shared by the packer and the validator so area
// conservation compares against the same rect both sides tile.
export function floorFootprint(plot: PlotConfig, floor: number, hasGroundParking: boolean): Rect {
  const b = buildableArea(plot, floor);
  if (floor > 0 && hasGroundParking) {
    const carved = carveParkingCorner(buildableArea(plot, 0), plot.roadSide);
    if (carved) return { ...carved.house };
  }
  return b;
}

// ---- Layout choices: knobs the engine turns into real geometry ----
export const DEFAULT_CHOICE: LayoutChoice = {
  mirror: false,
  stairSlot: 'left',
  kitchenCorner: 'rear-left',
  bandOrder: 0,
};

/** Within-band ordering nudge from the choice. 0 keeps catalog area order. */
function choiceBias(r: RoomRequirement, choice: LayoutChoice): number {
  if (r.type === 'kitchen') return choice.kitchenCorner === 'rear-left' ? -1 : 1;
  return 0;
}

/** Composite within-band rank: AI anchor dominates, the choice breaks ties. */
export function orderRank(r: RoomRequirement, choice: LayoutChoice, anchor: number): number {
  return anchor * 1000 + choiceBias(r, choice);
}

function ensureStaircase(reqs: RoomRequirement[], floors: number): RoomRequirement[] {
  // Staircase is now FURNITURE, not a room. Don't add it as a room requirement.
  // It will be placed as furniture inside a room (living/dining/foyer) by autoPlaceFurniture.
  return reqs.filter((r) => r.type !== 'staircase');
}

/**
 * Carve a parking bay corner at the road side.
 * Returns the bay + the two remaining rects (house band + road-side porch
 * column) which together tile the buildable area with zero void.
 * Returns null when the plot is too small — then parking packs as a room.
 * NOTE: the old code dropped the porch column (and for E/W roads even the
 * whole remainder), leaving huge empty voids like in the reported screenshot.
 */
function carveParkingCorner(
  buildable: Rect,
  roadSide: PlotConfig['roadSide'],
): { bay: Rect; house: Rect; porch: Rect } | null {
  // Single car bay: 10ft wide × 18ft deep (oriented per road side).
  // 10ft is the catalog preferred parking width (fits car + bike) and leaves
  // the porch narrow enough for a single living room within its area cap.
  const snap = (n: number) => Math.round(n * 2) / 2;
  if (roadSide === 'south' || roadSide === 'north') {
    const bw = Math.max(10, Math.min(12, snap(buildable.w * 0.4)));
    const bd = 18;
    if (buildable.w < bw + 6 || buildable.h < bd + 8 || bw < 8) return null;
    const onSouth = roadSide === 'south';
    const bay: Rect = onSouth
      ? { x: buildable.x, y: buildable.y + buildable.h - bd, w: bw, h: bd }
      : { x: buildable.x, y: buildable.y, w: bw, h: bd };
    const porch: Rect = onSouth
      ? { x: buildable.x + bw, y: buildable.y + buildable.h - bd, w: buildable.w - bw, h: bd }
      : { x: buildable.x + bw, y: buildable.y, w: buildable.w - bw, h: bd };
    const house: Rect = onSouth
      ? { x: buildable.x, y: buildable.y, w: buildable.w, h: buildable.h - bd }
      : { x: buildable.x, y: buildable.y + bd, w: buildable.w, h: buildable.h - bd };
    return { bay, house, porch };
  }
  // East / west: car length runs along X.
  const bw = 18;
  const bd = Math.min(12, snap(buildable.h * 0.4));
  if (buildable.h < bd + 6 || buildable.w < bw + 8 || bd < 8) return null;
  const onEast = roadSide === 'east';
  const bay: Rect = onEast
    ? { x: buildable.x + buildable.w - bw, y: buildable.y, w: bw, h: bd }
    : { x: buildable.x, y: buildable.y, w: bw, h: bd };
  const porch: Rect = onEast
    ? { x: buildable.x + buildable.w - bw, y: buildable.y + bd, w: bw, h: buildable.h - bd }
    : { x: buildable.x, y: buildable.y + bd, w: bw, h: buildable.h - bd };
  const house: Rect = onEast
    ? { x: buildable.x, y: buildable.y, w: buildable.w - bw, h: buildable.h }
    : { x: buildable.x + bw, y: buildable.y, w: buildable.w - bw, h: buildable.h };
  return { bay, house, porch };
}

/** Preferred footprint of the config's requirement for a type (catalog fallback). */
function prefAreaOfType(config: ProjectConfig, type: RoomRect['type']): number {
  const req = config.rooms.find((r) => r.type === type);
  const cat = ROOM_CATALOG[type];
  if (!req) return cat.preferredWidth * cat.preferredLength;
  return (req.preferredWidth || cat.preferredWidth) * (req.preferredLength || cat.preferredLength);
}

/**
 * Cap kitchen preferred area at 80% of the living room's preferred area on
 * the same floor (minimums always respected). Packing follows preference
 * areas, so an oversized kitchen preference is what grew kitchens past the
 * living room.
 */
function capKitchenVsLiving(reqs: RoomRequirement[]): RoomRequirement[] {
  const living = reqs.find((r) => r.type === 'living');
  const kitchen = reqs.find((r) => r.type === 'kitchen');
  if (!living || !kitchen) return reqs;
  const catL = ROOM_CATALOG[living.type];
  const catK = ROOM_CATALOG[kitchen.type];
  const livingArea = (living.preferredWidth || catL.preferredWidth) * (living.preferredLength || catL.preferredLength);
  const kitchenArea = (kitchen.preferredWidth || catK.preferredWidth) * (kitchen.preferredLength || catK.preferredLength);
  const cap = livingArea * 0.8;
  if (kitchenArea <= cap || cap <= 0) return reqs;
  const s = Math.sqrt(cap / kitchenArea);
  const pw = Math.max(kitchen.minWidth || catK.minWidth, (kitchen.preferredWidth || catK.preferredWidth) * s);
  const pl = Math.max(kitchen.minLength || catK.minLength, (kitchen.preferredLength || catK.preferredLength) * s);
  return reqs.map((r) =>
    r === kitchen
      ? { ...r, preferredWidth: Math.round(pw * 2) / 2, preferredLength: Math.round(pl * 2) / 2 }
      : r,
  );
}

/** Vastu: kitchen belongs in SE (Agni) or NW (Vayu) — never SW. Swap a SW
 * kitchen with an SE occupant when possible, else NW. Tiling preserved
 * (rects only permuted). */
function enforceVastuKitchen(out: RoomRect[], plot: PlotConfig, floor: number): void {
  const kitchens = out.filter((r) => r.floor === floor && r.type === 'kitchen');
  if (kitchens.length === 0) return;
  const quad = (r: RoomRect) => {
    const cx = (r.x + r.width / 2) / plot.width;
    const cy = (r.y + r.length / 2) / plot.length;
    if (cx >= 0.5 && cy >= 0.5) return 'SE';
    if (cx < 0.5 && cy < 0.5) return 'NW';
    if (cx < 0.5 && cy >= 0.5) return 'SW';
    return 'NE';
  };
  for (const k of kitchens) {
    if (quad(k) !== 'SW') continue;
    const sameFloor = out.filter((r) => r.floor === floor && r.id !== k.id && r.type !== 'parking');
    const se = sameFloor.filter((r) => quad(r) === 'SE' && r.type !== 'bathroom');
    se.sort((a, b) => Math.abs(a.width * a.length - k.width * k.length) - Math.abs(b.width * b.length - k.width * k.length));
    let partner = se[0];
    if (!partner) {
      const nw = sameFloor.filter((r) => quad(r) === 'NW' && r.type !== 'bathroom');
      nw.sort((a, b) => Math.abs(a.width * a.length - k.width * k.length) - Math.abs(b.width * b.length - k.width * k.length));
      partner = nw[0];
    }
    if (!partner) continue;
    const rx = k.x, ry = k.y, rw = k.width, rl = k.length;
    k.x = partner.x; k.y = partner.y; k.width = partner.width; k.length = partner.length;
    partner.x = rx; partner.y = ry; partner.width = rw; partner.length = rl;
  }
}

/** AI anchor → sort rank used inside each zone (front first, rear last). */
function anchorRankOf(p?: RoomPlacement): number {
  if (!p) return 2;
  switch (p.anchor) {
    case 'front': return 0;
    case 'center': return 1;
    case 'side': return 2;
    case 'rear': return 3;
  }
}

export function generateFloorLayout(
  config: ProjectConfig,
  choice: LayoutChoice,
  floor: number,
  floorReqs: RoomRequirement[] = expandRequirements(config.rooms),
  aiPlan?: AIPlan,
): RoomRect[] {
  // Tiled footprint for this floor (structural clamp for upper floors).
  const buildable = floorFootprint(config.plot, floor, config.rooms.some((r) => r.type === 'parking'));
  let reqs = [...floorReqs];
  if (config.floors > 1) {
    reqs = ensureStaircase(reqs, config.floors);
  }
  // A kitchen bigger than the living room is a planning smell (the reported
  // screenshot had 216 vs 132 sqft). Cap kitchen preference at 80% of the
  // living area for packing — the validator also warns if it still happens.
  reqs = capKitchenVsLiving(reqs);

  const out: RoomRect[] = [];

  const floorPlan = aiPlan?.floors.find((f) => f.floor === floor);
  const byName = new Map((floorPlan?.placements || []).map((p) => [p.name, p]));
  const rankOf = (r: RoomRequirement) => orderRank(r, choice, anchorRankOf(byName.get(r.name)));

  // Step 1: Carve the parking corner at the road side (ground floor only).
  // A parking bay is L-shaped leftovers' enemy: the corner bay PLUS the
  // road-side column beside it PLUS the house band behind it tile the
  // buildable rect with ZERO void (the old code dropped the column).
  // Parking never packs with bedrooms (noise/fume rule).
  const wantsParking = floor === 0 && reqs.some((r) => r.type === 'parking');
  let houseRect = buildable;
  let porchRect: Rect | null = null;
  if (wantsParking) {
    const carved = carveParkingCorner(buildable, config.plot.roadSide);
    if (carved) {
      const parkingReq = reqs.find((r) => r.type === 'parking')!;
      out.push({
        id: genId(),
        type: 'parking',
        name: parkingReq.name,
        x: round(carved.bay.x),
        y: round(carved.bay.y),
        width: round(carved.bay.w),
        length: round(carved.bay.h),
        floor,
        doors: [{ wall: roadWallSide(carved.bay, config.plot), pos: 0.5, width: 10, swing: 'out-right' as const }],
        windows: [],
      });
      reqs = reqs.filter((r) => r.type !== 'parking');
      houseRect = carved.house;
      porchRect = carved.porch;
    }
  }

  // Step 2: Zone-clustered placement (public front, private rear, service side).
  // When the AI reasoned about this floor, its anchors refine ordering inside
  // each zone and its adjacency pairs steer the optimizer via strategy bias.
  // The road-side porch column (if any) takes public rooms first — entry,
  // foyer and living belong by the road, exactly as built in Indian homes.
  const orderedReqs = [...reqs].sort((a, b) => rankOf(a) - rankOf(b));
  let placed: RoomRect[] = [];
  let porchReqs: RoomRequirement[] = [];
  let houseReqs = orderedReqs;
  // Pack-group key per room id: repair swaps stay inside one group so rooms
  // never teleport across bands (which breaks tiling and band order).
  const packGroup = new Map<string, string>();
  if (porchRect) {
    const porchArea = porchRect.w * porchRect.h;
    let used = 0;
    const rest: RoomRequirement[] = [];
    for (const r of orderedReqs) {
      const cat = ROOM_CATALOG[r.type];
      const pa = (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
      // The foyer belongs to the house entry band (as door buffer), never the
      // porch: a 6x6 foyer cannot share the porch rect without stranding as
      // a sliver, and the entry sequence runs porch -> foyer -> living.
      const isPublic = (cat.group === 'public' || cat.group === 'circulation') && r.type !== 'foyer';
      if (isPublic && used + pa <= porchArea * 1.15) {
        porchReqs.push(r);
        used += pa;
      } else {
        rest.push(r);
      }
    }
    // BOND: kitchen and dining must stay together (serving link). If the
    // porch/house split separated them, prefer keeping the pair in the porch
    // (a big porch hosts the social core well); otherwise pull the straggler
    // back to the house. This prevents dining ending up next to parking
    // while the kitchen sits on the opposite side of the house.
    const porchHasDining = porchReqs.some((r) => r.type === 'dining');
    const porchHasKitchen = porchReqs.some((r) => r.type === 'kitchen');
    const restHasDining = rest.some((r) => r.type === 'dining');
    const restHasKitchen = rest.some((r) => r.type === 'kitchen');
    const kitchenPa = (() => {
      const k = rest.find((r) => r.type === 'kitchen');
      if (!k) return 0;
      const cat = ROOM_CATALOG[k.type];
      return (k.preferredWidth || cat.preferredWidth) * (k.preferredLength || cat.preferredLength);
    })();
    if (porchHasDining && restHasKitchen && used + kitchenPa <= porchArea * 1.15) {
      // Kitchen joins dining in the porch — the pair stays together by the road.
      const kitchen = rest.filter((r) => r.type === 'kitchen');
      for (const k of kitchen) {
        rest.splice(rest.indexOf(k), 1);
        porchReqs.push(k);
        used += kitchenPa / Math.max(1, kitchen.length);
      }
    } else if (porchHasDining && restHasKitchen) {
      // Dining is in porch, kitchen is in house — pull dining back to house
      const dining = porchReqs.filter((r) => r.type === 'dining');
      porchReqs = porchReqs.filter((r) => r.type !== 'dining');
      rest.push(...dining);
    } else if (porchHasKitchen && restHasDining) {
      // Kitchen is in porch, dining is in house — pull kitchen back to house
      const kitchen = porchReqs.filter((r) => r.type === 'kitchen');
      porchReqs = porchReqs.filter((r) => r.type !== 'kitchen');
      rest.push(...kitchen);
    }
    houseReqs = rest;
    if (porchReqs.length > 0) {
      // Optimize within the porch group only — never across pack areas.
      const porchRooms = optimizeAdjacencies(packRooms(porchRect, porchReqs, floor));
      for (const r of porchRooms) packGroup.set(r.id, 'porch');
      placed.push(...porchRooms);
    }
  }

  // Front→rear band packing (AI Context §5). Each band gets a strip of the
  // house rect proportional to its summed preferred area; BSP runs inside
  // each strip. Bands tile houseRect exactly (last strip takes the
  // remainder, absorbing rounding). allocateZones stays exported for other
  // consumers but is no longer on this path.
  // Bands always stack as full-width horizontal strips. The house spans the
  // full buildable width on every road side, so every strip's left/right
  // walls are external (habitable-window invariant holds by construction).
  // Vertical strips would strand middle-strip rooms with no external wall.
  // Order is front→rear on north/south roads; top→bottom on east/west where
  // every strip touches the road edge along its full width.
  const fromHigh = config.plot.roadSide === 'south' || config.plot.roadSide === 'east';
  const bandPref = (r: RoomRequirement) => {
    const cat = ROOM_CATALOG[r.type];
    return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  };
  let bandGroups = assignBands(houseReqs, floor);
  // bandOrder 1 swaps the last two bands, moving whole room groups
  // front-to-rear (dining ahead of the kitchen instead of behind it, service
  // behind the private band). The entry band always stays at the road.
  if (choice.bandOrder === 1 && bandGroups.length >= 2) {
    const n = bandGroups.length;
    bandGroups = [...bandGroups.slice(0, n - 2), bandGroups[n - 1], bandGroups[n - 2]];
  }
  // Ribbon guard: a band strip must be deep enough for its members' aspect
  // needs (capped room types: sqrt of clamped target area over max aspect),
  // and never under MIN_BAND_DEPTH. Too-thin bands merge into a neighbor
  // instead of manufacturing slivers. The merged rooms pack together via BSP.
  const needDim = (r: RoomRequirement): number => {
    const cat = ROOM_CATALOG[r.type];
    if (CAPPED_TYPES.has(r.type)) {
      const target = Math.min(bandPref(r), cat.maxArea);
      return Math.sqrt(target / cat.maxAspect);
    }
    return Math.sqrt(((r.minWidth || cat.minWidth) * (r.minLength || cat.minLength)) / 2);
  };
  // Clamped sums: members never need more than their caps (capped types) or
  // prefs, so strips sized past the clamped sum would only flood someone.
  const bandSize = (r: RoomRequirement): number => {
    const cat = ROOM_CATALOG[r.type];
    return CAPPED_TYPES.has(r.type) ? Math.min(bandPref(r), cat.maxArea) : bandPref(r);
  };
  // A band with no capped members can never violate caps. On upper floors it
  // keeps its own strip: the stair lobby must span full width to touch every
  // bedroom (distribution hall with private doors). On the ground the foyer
  // merges into the entry/social bands where 4-room granularity splits
  // better. Other bands merge when thinner than their aspect needs.
  const hasCapped = (g: { reqs: RoomRequirement[] }) => g.reqs.some((r) => CAPPED_TYPES.has(r.type));
  // Uncapped-only strips need just door/landing workability (3.5ft swing):
  // 4ft, not the full MIN_BAND_DEPTH.
  const HALL_DEPTH = 4;
  for (let pass = 0; pass < 3 && bandGroups.length > 1; pass++) {
    const total = bandGroups.reduce((s, g) => s + g.reqs.reduce((a, r) => a + bandSize(r), 0), 0) || 1;
    const thin = bandGroups.findIndex((g) => {
      if (!hasCapped(g) && floor > 0) return false;
      const need = Math.max(MIN_BAND_DEPTH, ...g.reqs.map(needDim));
      return (houseRect.h * g.reqs.reduce((a, r) => a + bandSize(r), 0)) / total < need;
    });
    if (thin < 0) break;
    const victim = bandGroups.splice(thin, 1)[0];
    const host = bandGroups[Math.min(thin, bandGroups.length - 1)];
    host.reqs.push(...victim.reqs);
  }
  const bandTotals = bandGroups.map((g) => g.reqs.reduce((s, r) => s + bandSize(r), 0));
  const bandGrand = bandTotals.reduce((a, b) => a + b, 0) || 1;
  const bandClamped = [...bandTotals];
  let cursor = fromHigh ? houseRect.y + houseRect.h : houseRect.y;
  // Far edge: leftover past the last clamped strip becomes the garden below;
  // strips plus garden tile the rect exactly.
  const farEdge = fromHigh ? houseRect.y : houseRect.y + houseRect.h;
  // Walk first, place after: clamped strips may leave a rear remainder. When
  // it fits a usable garden (>= 6x6 and >= 48 sqft) it becomes open-to-sky
  // balcony space; otherwise the last strip absorbs it (no void ever).
  // Uncapped-only bands (hall/passage circulation) are boosted to a workable
  // HALL_DEPTH hall when later bands still fit their needs after the boost;
  // otherwise they keep their share (best effort, flagged honestly).
  const groupNeed = bandGroups.map((g) =>
    hasCapped(g) ? Math.max(MIN_BAND_DEPTH, ...g.reqs.map(needDim)) : HALL_DEPTH,
  );
  const stripRects: Rect[] = [];
  let walkEnd = cursor;
  bandGroups.forEach((g, i) => {
    const frac = bandTotals[i] / bandGrand;
    const shareDepth = Math.round(houseRect.h * frac * 2) / 2;
    const clampDepth = bandClamped[i] / Math.max(1, houseRect.w);
    let depth = Math.min(shareDepth, clampDepth);
    if (!hasCapped(g) && depth < HALL_DEPTH) {
      const laterReserve = bandGroups
        .slice(i + 1)
        .reduce((s, _h, j) => s + Math.max(
          Math.round(houseRect.h * (bandTotals[i + 1 + j] / bandGrand) * 2) / 2,
          groupNeed[i + 1 + j],
        ), 0);
      const spaceLeft = houseRect.h - Math.abs(walkEnd - cursor);
      depth = Math.min(HALL_DEPTH, Math.max(depth, spaceLeft - laterReserve));
      if (depth < shareDepth) depth = shareDepth;
    }
    const rect: Rect = fromHigh
      ? { x: houseRect.x, y: walkEnd - depth, w: houseRect.w, h: depth }
      : { x: houseRect.x, y: walkEnd, w: houseRect.w, h: depth };
    stripRects.push(rect);
    walkEnd += fromHigh ? -depth : depth;
  });
  // The last strip always absorbs the remainder, so strips tile houseRect
  // exactly. No remnant is ever turned into a room the user did not ask for
  // (the old code manufactured a "Garden"/"Terrace" balcony here).
  if (stripRects.length > 0) {
    // Extend the last strip from its packed edge out to the far edge,
    // keeping its placed edge.
    const last = stripRects[stripRects.length - 1];
    if (fromHigh) {
      last.h = last.y + last.h - farEdge;
      last.y = farEdge;
    } else {
      last.h = farEdge - last.y;
    }
  }
  bandGroups.forEach((g, i) => {
    const rect = stripRects[i];
    const bandRooms = optimizeAdjacencies(placeZoneRooms({ zone: 'public', rooms: g.reqs, rect }, floor, config.plot, rankOf));
    for (const r of bandRooms) packGroup.set(r.id, `band-${g.band}`);
    placed.push(...bandRooms);
    cursor += fromHigh ? -rect.h : rect.h;
  });

  // Step 3: (per-group adjacency optimization already applied above)
  out.push(...placed);
  // Mirror knob: reflect this floor across the axis PARALLEL to the road, so
  // the road side is preserved while the plan genuinely flips (parking left
  // vs right). Applied before the door solver, so openings are solved on the
  // final geometry.
  if (choice.mirror) mirrorFloor(out.filter((r) => r.floor === floor), config.plot);
  if (process.env.LAYOUT_DEBUG === '1') {
    for (const r of out.filter((x) => x.floor === floor)) console.error(`[layout-debug] packed f${floor} ${r.type}:${r.name} ${r.width}x${r.length} @(${r.x},${r.y})`);
  }

  // Step 3b: Vastu lock — kitchen (fire) must never sit in SW (earth). When
  // enabled, swap a SW kitchen with an SE occupant (or NW fallback).
  if (config.vastuEnabled) enforceVastuKitchen(out, config.plot, floor);

  // Step 4: Deterministic door + window solver over the whole floor, so doors
  // sit on real shared walls between connected rooms (never random).
  const openings = solveOpenings(
    out.filter((r) => r.type !== 'parking'),
    config.plot,
  );
  for (const r of out) {
    if (r.type === 'parking') {
      // Banded parking (carve infeasible on narrow plots) never saw the door
      // solver, which skips parking: give it the road shutter directly.
      if (r.doors.length === 0) {
        r.doors.push({ wall: roadWallSide({ x: r.x, y: r.y, w: r.width, h: r.length }, config.plot), pos: 0.5, width: 10, swing: 'out-right' });
      }
      continue;
    }
    const o = openings.get(r.id);
    if (o) {
      r.doors = o.doors;
      r.windows = o.windows;
    }
  }

  // Step 5: Move any door that opens into a prohibited neighbor to the best
  // free wall (shared walls alone are fine — doors into them are not).
  repairProhibitedDoors(out.filter((r) => r.floor === floor));

  // Step 6: Swap-repair against the REAL validator — while the diagnosis
  // score improves, try pairwise rect swaps within one pack group (tiling
  // preserved: the rect set is only permuted, so no void and no overlap can
  // ever result; parking never moves). Score = hard errors first, then
  // ballooning, then warnings.
  repairGeometry(config, out, floor, (id) => packGroup.get(id) ?? 'bay');

  // Step 7: Connectivity — BFS from the foyer over door edges (bedrooms are
  // sinks). Every unvisited room adjacent to the visited set gets a paired
  // door on the shared wall, to fixpoint. Parking is entered from the road.
  ensureConnectivity(out, floor);

  return out;
}

// (Zone-based packing lives in architecture/planner.ts — bspPackZone.
// The old flat bspPack was removed: it tiled rooms with zero zone awareness,
// which is what put bedrooms next to parking.)

// Distribute room requirements across floors.
// Ground floor: parking, living, kitchen, DINING (always with kitchen),
// foyer, and a powder bath only with a foyer buffer.
// Upper floors: bedrooms, remaining bathrooms, pooja, balcony, office, utility, store.
// If config.floorAssignment is provided, use it instead of the default distribution.
// Exported: the AI planner renders the exact same split into its prompt
// (FLOOR BRIEF) so brain and ruler never disagree about floor contents.
export function distributeRoomsByFloor(reqs: RoomRequirement[], floors: number, floorAssignment?: Record<string, number[]>): RoomRequirement[][] {
  // If user provided a floor assignment, use it
  if (floorAssignment) {
    const expanded = expandRequirements(reqs);
    const byFloor: RoomRequirement[][] = Array.from({ length: floors }, () => []);
    const counters: Record<string, number> = {};
    for (const r of expanded) {
      const assignment = floorAssignment[r.type];
      const idx = counters[r.type] || 0;
      counters[r.type] = idx + 1;
      // Find which floor this instance should go on
      let targetFloor = 0;
      if (assignment) {
        let acc = 0;
        for (let f = 0; f < assignment.length; f++) {
          acc += assignment[f];
          if (idx < acc) { targetFloor = f; break; }
        }
        targetFloor = Math.min(targetFloor, floors - 1);
      }
      byFloor[targetFloor].push(r);
    }
    return byFloor;
  }

  // Default automatic distribution — follows real Indian residential architecture:
  // Ground floor: parking, living, kitchen, DINING (always with kitchen), 1 bathroom (powder room, if buffered)
  // Upper floors: bedrooms, remaining bathrooms, pooja, balcony, office, utility, store
  // NOTE: staircases are FURNITURE, never rooms (see autoPlaceFurniture).
  // They are placed per floor below the top after packing, clear of other
  // furniture and door swings.
  const expanded = expandRequirements(reqs);
  const byFloor: RoomRequirement[][] = Array.from({ length: floors }, () => []);

  // Rooms that ALWAYS go on ground floor (public zone)
  const groundTypes = new Set(['parking', 'living', 'dining', 'kitchen', 'foyer']);

  // Place ground floor rooms
  for (const r of expanded) {
    if (groundTypes.has(r.type)) byFloor[0].push(r);
  }

  // Place 1 bathroom on the ground floor (powder room) ONLY when a foyer
  // exists to buffer it. Without a buffer, a ground bath inevitably ends up
  // opening directly into living/dining/kitchen — a hard rule violation
  // (bathrooms must touch the bedroom they serve, never public rooms).
  const hasFoyer = expanded.some((r) => r.type === 'foyer');
  const bathrooms = expanded.filter((r) => r.type === 'bathroom');
  if (floors > 1 && bathrooms.length > 0 && hasFoyer) {
    byFloor[0].push(bathrooms[0]);
  }

  // Remaining rooms go upstairs
  const groundRoomIds = new Set(byFloor[0]);
  const upstairsRooms = expanded.filter((r) => !groundRoomIds.has(r));

  if (floors === 1) {
    byFloor[0].push(...upstairsRooms);
  } else if (byFloor[0].length === 0) {
    // Degenerate program (e.g. bedrooms + bathrooms only — no public rooms
    // at all). Piling everything onto the upper floors and leaving the
    // ground floor EMPTY is never right; spread across all floors instead.
    const perFloor = Math.ceil(upstairsRooms.length / floors);
    for (let f = 0; f < floors; f++) {
      byFloor[f] = upstairsRooms.slice(f * perFloor, (f + 1) * perFloor);
    }
  } else {
    // Distribute upstairs rooms evenly across upper floors
    const perFloor = Math.ceil(upstairsRooms.length / (floors - 1));
    for (let f = 1; f < floors; f++) {
      byFloor[f] = upstairsRooms.slice((f - 1) * perFloor, f * perFloor);
    }
  }

  // Duplex circulation: every upper floor needs a common lobby for the stair
  // landing (never arrive inside a bedroom). Auto-add an Upper Lobby foyer
  // when no foyer/living/dining/office is assigned upstairs.
  if (floors > 1 && !floorAssignment) {
    const COMMON = new Set(['foyer', 'living', 'dining', 'office']);
    for (let f = 1; f < floors; f++) {
      if (!byFloor[f].some((r) => COMMON.has(r.type))) {
        byFloor[f].push({
          type: 'foyer',
          name: 'Upper Lobby',
          count: 1,
          minWidth: 5,
          minLength: 5,
          preferredWidth: 6,
          preferredLength: 8,
          priority: 'high',
        });
      }
    }
  }

  return byFloor;
}

function roadWallSide(p: Rect, plot: PlotConfig): DoorMarker['wall'] {
  switch (plot.roadSide) {
    case 'south':
      return 'bottom';
    case 'north':
      return 'top';
    case 'east':
      return 'right';
    case 'west':
      return 'left';
  }
}

/**
 * Re-home expanded instances onto the AI plan's floors (matched by
 * type+name). Applied only when the plan covers ≥80% of instances —
 * otherwise the AI went rogue and the deterministic split stands.
 * Parking always stays on the ground (only floor 0 carves a bay).
 */
function applyPlanFloors(byFloor: RoomRequirement[][], plan: AIPlan, floors: number): void {
  const all = byFloor.flat();
  if (all.length === 0) return;
  const floorOf = new Map<string, number>();
  for (const f of plan.floors) {
    const fi = Math.max(0, Math.min(floors - 1, f.floor));
    for (const p of f.placements) {
      const key = `${p.type}|${p.name}`;
      if (!floorOf.has(key)) floorOf.set(key, fi);
    }
  }
  const matched = all.filter((r) => floorOf.has(`${r.type}|${r.name}`)).length;
  if (matched < all.length * 0.8) return;
  const buckets: RoomRequirement[][] = Array.from({ length: floors }, () => []);
  for (const r of all) {
    if (r.type === 'parking') {
      buckets[0].push(r); // bays only exist on the ground
    } else {
      buckets[floorOf.get(`${r.type}|${r.name}`) ?? 0].push(r);
    }
  }
  for (let f = 0; f < floors; f++) byFloor[f] = buckets[f];
}

/** Reflect rooms across the axis parallel to the road (in place). */
function mirrorFloor(rooms: RoomRect[], plot: PlotConfig): void {
  const flipX = plot.roadSide === 'north' || plot.roadSide === 'south';
  for (const r of rooms) {
    if (flipX) r.x = round(plot.width - r.x - r.width);
    else r.y = round(plot.length - r.y - r.length);
  }
}

export function generateLayout(config: ProjectConfig, choice: LayoutChoice, aiPlan?: AIPlan): LayoutData {
  // Deterministic ids: same config + choice => same ids on every run.
  beginSeededIds(hashSeed(JSON.stringify({ config, choice })));
  try {
    return buildLayout(config, choice, aiPlan);
  } finally {
    endSeededIds();
  }
}

function buildLayout(config: ProjectConfig, choice: LayoutChoice, aiPlan?: AIPlan): LayoutData {
  const rooms: RoomRect[] = [];
  const normalized = normalizeRequirements(config.rooms, config.preferences);
  const byFloor = distributeRoomsByFloor(normalized.reqs, config.floors, config.floorAssignment);
  if (aiPlan) applyPlanFloors(byFloor, aiPlan, config.floors);
  for (let f = 0; f < config.floors; f++) {
    const floorRooms = generateFloorLayout(config, choice, f, byFloor[f] || [], aiPlan);
    rooms.push(...floorRooms);
  }
  // Enforce a private en-suite for the master + a real front entrance before
  // furniture, so swings and fixtures plan around the final doors.
  ensureMasterEnSuite(rooms);
  ensureFrontEntrance(rooms, config.plot);
  // auto-place starter furniture in each room based on room type
  const furniture = autoPlaceFurniture(rooms);
  // Slide doors along their walls (mirrored twin included) so no door swing
  // lands on furniture, then re-seat non-staircase furniture against the final door spots.
  // Parking shutters and staircases are exempt (stairs stack vertically; cars live under shutters).
  nudgeDoorsClearOfFurniture(rooms, furniture);
  for (const f of furniture) {
    if (f.type === 'staircase' || f.type === 'spiral-staircase' || f.type === 'car' || f.type === 'bike') continue;
    const cx = f.x + f.width / 2;
    const cy = f.y + f.length / 2;
    const room = rooms.find(
      (r) => r.floor === f.floor && cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.length,
    );
    if (!room) continue;
    const others = furniture
      .filter((o) => o.id !== f.id && o.floor === f.floor)
      .map((o) => ({ x: o.x, y: o.y, w: o.width, h: o.length }));
    const spot = bestCorner(room, f.width, f.length, others);
    f.x = round(spot.x);
    f.y = round(spot.y);
  }
  return {
    plot: config.plot,
    floors: config.floors,
    rooms,
    furniture,
    choice,
    choiceLabel: choiceLabel(choice),
    reasoning: aiPlan?.reasoning,
    assumptions: [],
  };
}

// Auto-place ONLY minimal essential furniture (one key item per room).
// The user adds everything else via the Furniture tool.
function autoPlaceFurniture(rooms: RoomRect[]): import('../types').FurnitureItem[] {
  const items: import('../types').FurnitureItem[] = [];
  const put = (f: import('../types').FurnitureItem | null) => {
    if (f) items.push(f);
  };
  for (const room of rooms) {
    switch (room.type) {
      case 'bedroom': {
        // Big room → double bed; small room → single bed (a 6ft bed plus a
        // door swing cannot physically clear an 8ft room — stage honestly).
        const area = room.width * room.length;
        if (area >= 100) put(fitFurniture('bed-double', room, Math.min(6, room.width - 1), Math.min(7, room.length - 1), items));
        else put(fitFurniture('bed-single', room, Math.min(3.5, room.width - 1), Math.min(6.5, room.length - 1), items));
        break;
      }
      case 'living': {
        const area = room.width * room.length;
        if (area >= 130) put(fitFurniture('sofa-3', room, Math.min(7, room.width - 1), Math.min(3, room.length - 1), items));
        else put(fitFurniture('sofa-2', room, Math.min(5, room.width - 1), Math.min(3, room.length - 1), items));
        break;
      }
      case 'kitchen': {
        // Just a kitchen counter — the essential. User adds stove, sink, fridge, island.
        put(fitFurniture('kitchen-counter', room, Math.min(8, room.width - 1), Math.min(2, room.length - 1), items));
        break;
      }
      case 'dining': {
        const area = room.width * room.length;
        if (area >= 70) put(fitFurniture('table-dining-6', room, Math.min(5, room.width - 1), Math.min(3, room.length - 1), items));
        else put(fitFurniture('table-round', room, Math.min(4, room.width - 1), Math.min(4, room.length - 1), items));
        break;
      }
      case 'bathroom': {
        // Just a toilet — the essential. User adds vanity, shower, bathtub.
        put(fitFurniture('toilet', room, Math.min(2, room.width - 1), Math.min(3, room.length - 1), items));
        break;
      }
      case 'office': {
        // Just a desk — the essential. User adds chair, bookshelf.
        put(fitFurniture('desk', room, Math.min(5, room.width - 1), Math.min(2.5, room.length - 1), items));
        break;
      }
      case 'pooja': {
        // Just the altar — the essential.
        put(fitFurniture('pooja-altar', room, Math.min(3, room.width - 1), Math.min(1.5, room.length - 1), items));
        break;
      }
      case 'parking': {
        // Car + bike are standard/essential for Indian homes.
        put(fitFurniture('car', room, Math.min(6, room.width - 1), Math.min(10, room.length - 1), items));
        const carW = Math.min(6, room.width - 1);
        const bikeX = room.x + 1 + carW + 1;
        if (bikeX + 2.5 < room.x + room.width - 0.5) {
          put(fitFurniture('bike', { ...room, x: bikeX }, 2.5, Math.min(6, room.length - 1), items));
        }
        break;
      }
      case 'staircase':
      case 'balcony':
      case 'utility':
      case 'foyer':
      case 'store':
      default:
        // No auto-furniture — user furnishes these.
        break;
    }
  }

  // Place staircase as FURNITURE inside a room for multi-floor buildings.
  // Staircase is NOT a room — it lives in a corner of a host room, clear of
  // that room's furniture and door swings (never blindly bottom-right, which
  // is what stacked it on top of sofas). Exactly one per floor below the top
  // (it climbs to the next floor), so presence is guaranteed, not hoped for.
  const floorList = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  if (floorList.length > 1) {
    // Vertical alignment: stairs must stack at the same XY on every floor
    // (a stair that teleports between floors is unbuildable). The ground
    // flight sets the anchor; upper flights reuse the exact spot when a
    // host room there contains it, else fall back to corner search.
    let anchor: { x: number; y: number; w: number; h: number } | null = null;
    // Upper common lobbies (for stackable ground-host preference).
    const lobbyRects = rooms.filter((r) => r.floor > 0 && LANDING_HOSTS.has(r.type));
    const overlapsLobby = (h: RoomRect) =>
      lobbyRects.some((l) => {
        const ix = Math.min(h.x + h.width, l.x + l.width) - Math.max(h.x, l.x);
        const iy = Math.min(h.y + h.length, l.y + l.length) - Math.max(h.y, l.y);
        return ix >= 4 && iy >= 7;
      });
    for (const f of floorList) {
      if (f >= Math.max(...floorList)) continue; // top floor needs no up-stair
      const hosts = rooms
        .filter((r) => r.floor === f && r.type !== 'parking')
        .sort((a, b) => {
          // Ground flight prefers a host that stacks over an upper lobby.
          if (f === 0) {
            const ao = overlapsLobby(a) ? 0 : 1;
            const bo = overlapsLobby(b) ? 0 : 1;
            if (ao !== bo) return ao - bo;
          }
          return hostRank(a.type) - hostRank(b.type) || b.width * b.length - a.width * a.length;
        });
      for (const host of hosts) {
        const stair = placeStaircaseIn(host, items, f, anchor);
        if (stair) {
          items.push(stair);
          if (!anchor) anchor = { x: stair.x, y: stair.y, w: stair.width, h: stair.length };
          break;
        }
      }
    }
    // Place a staircase LANDING on the top floor. Privacy beats perfect
    // stacking: the landing must arrive into a common lobby (foyer/living/
    // dining/office), never inside a bedroom/bathroom/kitchen. Prefer the
    // same stacked XY when a common room contains it; otherwise fall back to
    // a clear side-wall corner in the best common host.
    if (anchor) {
      const topFloor = Math.max(...floorList);
      const topRooms = rooms.filter((r) => r.floor === topFloor && r.type !== 'parking');
      const contains = (h: RoomRect) =>
        anchor!.x >= h.x + 0.4 &&
        anchor!.y >= h.y + 0.4 &&
        anchor!.x + anchor!.w <= h.x + h.width + 0.1 &&
        anchor!.y + anchor!.h <= h.y + h.length + 0.1;
      const clearOfFurniture = (x: number, y: number, w: number, h: number) => {
        const topBlockers = items
          .filter((it) => it.floor === topFloor)
          .map((it) => ({ x: it.x, y: it.y, w: it.width, h: it.length }));
        return !topBlockers.some((b) => rectsOverlapLoose({ x, y, w, h }, b, 0.25));
      };
      // 1. Stacked anchor inside a common host.
      const stacked = topRooms
        .filter((h) => LANDING_HOSTS.has(h.type) && contains(h))
        .sort((a, b) => hostRank(a.type) - hostRank(b.type))[0]
        || topRooms.filter((h) => !LANDING_BANNED.has(h.type) && contains(h))[0];
      if (stacked && clearOfFurniture(anchor.x, anchor.y, anchor.w, anchor.h)) {
        items.push({
          id: genId('f'), type: 'staircase', name: 'staircase',
          x: round(anchor.x), y: round(anchor.y),
          width: round(anchor.w), length: round(anchor.h),
          rotation: 0, floor: topFloor,
        });
      } else {
        // 2. Fresh side-wall corner in the best common host (privacy over stacking).
        const hosts = [...topRooms].sort(
          (a, b) => hostRank(a.type) - hostRank(b.type) || b.width * b.length - a.width * a.length,
        );
        let landed = false;
        for (const host of hosts) {
          if (LANDING_BANNED.has(host.type)) continue;
          const stair = placeStaircaseIn(host, items, topFloor, null);
          if (stair) {
            items.push(stair);
            landed = true;
            break;
          }
        }
        // 3. Last resort: compact stairwell opening (3×4) in the upper lobby.
        // A tight 30×40 upper lobby can be too shallow for a full 4×7 flight;
        // a smaller opening marker still shows arrival in common space and
        // never violates bedroom privacy with a missing stair.
        if (!landed) {
          const lobby = hosts.find((h) => !LANDING_BANNED.has(h.type));
          if (lobby) {
            const w = Math.min(4, lobby.width - 1);
            const l = Math.min(4, lobby.length - 1);
            if (w >= 3 && l >= 3) {
              const m = 0.5;
              const corners = [
                { x: lobby.x + m, y: lobby.y + m },
                { x: lobby.x + lobby.width - w - m, y: lobby.y + m },
                { x: lobby.x + m, y: lobby.y + lobby.length - l - m },
                { x: lobby.x + lobby.width - w - m, y: lobby.y + lobby.length - l - m },
              ];
              const blockers = items
                .filter((it) => it.floor === topFloor)
                .map((it) => ({ x: it.x, y: it.y, w: it.width, h: it.length }));
              for (const s of doorSwingRects(lobby)) blockers.push(s);
              for (const c of corners) {
                if (blockers.some((b) => rectsOverlapLoose({ x: c.x, y: c.y, w, h: l }, b, 0.25))) continue;
                items.push({
                  id: genId('f'), type: 'staircase', name: 'staircase',
                  x: round(c.x), y: round(c.y), width: round(w), length: round(l),
                  rotation: 0, floor: topFloor,
                });
                landed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  return items;
}

/**
 * Clamp a furniture footprint inside its room (0.5ft margin) AND clear of
 * every door swing — a counter under a door arc was the reported bug.
 * Tries all four corners deterministically, keeps the first clear one.
 * Returns null when the room is too small to hold even a scaled-down piece.
 */
function fitFurniture(
  type: import('../types').FurnitureType,
  room: RoomRect,
  w: number,
  l: number,
  existingItems: import('../types').FurnitureItem[] = [],
): import('../types').FurnitureItem | null {
  const maxW = room.width - 1;
  const maxL = room.length - 1;
  if (maxW < 1.5 || maxL < 1.5) return null;
  const cw = Math.min(w, maxW);
  const cl = Math.min(l, maxL);
  if (cw < 1 || cl < 1) return null;
  const others = existingItems
    .filter((it) => it.floor === room.floor)
    .map((it) => ({ x: it.x, y: it.y, w: it.width, h: it.length }));
  const spot = bestCorner(room, cw, cl, others);
  return {
    id: genId('f'),
    type,
    name: type,
    x: round(spot.x),
    y: round(spot.y),
    width: round(cw),
    length: round(cl),
    rotation: 0,
    floor: room.floor,
  };
}

/** Host-room preference for the staircase: dedicated foyer/lobby first, then
 * social core along a side perimeter wall — never private rooms unless forced. */
function hostRank(type: RoomRect['type']): number {
  const order = ['foyer', 'living', 'dining', 'office', 'utility', 'store', 'kitchen', 'balcony', 'pooja', 'bedroom', 'bathroom'];
  const i = order.indexOf(type);
  return i < 0 ? 99 : i;
}

/** Room types the upstairs stair landing may arrive into (common lobby only). */
const LANDING_HOSTS = new Set(['foyer', 'living', 'dining', 'office']);
/** Room types the landing must never arrive into (privacy violation). */
const LANDING_BANNED = new Set(['bedroom', 'bathroom', 'kitchen']);

function rectsOverlapLoose(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 0,
): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/**
 * Fit a 3.5–7ft wide staircase flight into `host` clear of existing
 * furniture (same floor) and door swings. Tries full size then a compact
 * 4×7 flight, across all four corners. Returns null when nothing fits.
 */
function placeStaircaseIn(
  host: RoomRect,
  items: import('../types').FurnitureItem[],
  floor: number,
  anchor: { x: number; y: number; w: number; h: number } | null,
): import('../types').FurnitureItem | null {
  const m = 0.5;
  // 1. Anchor reuse: same XY as the flight below, when it fits this host
  //    clear of this floor's furniture and swings (vertical stacking).
  if (anchor) {
    const fits =
      anchor.x >= host.x + m - 0.01 &&
      anchor.y >= host.y + m - 0.01 &&
      anchor.x + anchor.w <= host.x + host.width - m + 0.01 &&
      anchor.y + anchor.h <= host.y + host.length - m + 0.01;
    if (fits) {
      const blockers = items
        .filter((it) => it.floor === floor)
        .map((it) => ({ x: it.x, y: it.y, w: it.width, h: it.length }));
      for (const s of doorSwingRects(host)) blockers.push(s);
      if (!blockers.some((b) => rectsOverlapLoose(anchor, b, 0.25))) {
        return {
          id: genId('f'), type: 'staircase', name: 'staircase',
          x: round(anchor.x), y: round(anchor.y),
          width: round(anchor.w), length: round(anchor.h),
          rotation: 0, floor,
        };
      }
    }
  }
  const sizes = [
    { w: Math.min(7, host.width - 1), l: Math.min(12, host.length - 1) },
    { w: Math.min(4, host.width - 1), l: Math.min(7, host.length - 1) },
  ];
  const blockers = items
    .filter((it) => it.floor === floor)
    .map((it) => ({ x: it.x, y: it.y, w: it.width, h: it.length }));
  for (const s of doorSwingRects(host)) blockers.push(s);
  for (const s of sizes) {
    if (s.w < 3 || s.l < 6) continue;
    // Side-perimeter first: left-wall corners before right-wall corners, so a
    // living/dining-hosted stair stays out of the primary seating arc.
    const corners =
      host.type === 'living' || host.type === 'dining'
        ? [
            { x: host.x + m, y: host.y + m },
            { x: host.x + m, y: host.y + host.length - s.l - m },
            { x: host.x + host.width - s.w - m, y: host.y + m },
            { x: host.x + host.width - s.w - m, y: host.y + host.length - s.l - m },
          ]
        : [
            { x: host.x + m, y: host.y + m },
            { x: host.x + host.width - s.w - m, y: host.y + m },
            { x: host.x + m, y: host.y + host.length - s.l - m },
            { x: host.x + host.width - s.w - m, y: host.y + host.length - s.l - m },
          ];
    for (const c of corners) {
      const r = { x: c.x, y: c.y, w: s.w, h: s.l };
      if (c.x < host.x + m - 0.01 || c.y < host.y + m - 0.01) continue;
      if (r.x + r.w > host.x + host.width - m + 0.01 || r.y + r.h > host.y + host.length - m + 0.01) continue;
      if (blockers.some((b) => rectsOverlapLoose(r, b, 0.25))) continue;
      return {
        id: genId('f'),
        type: 'staircase',
        name: 'staircase',
        x: round(c.x),
        y: round(c.y),
        width: round(s.w),
        length: round(s.l),
        rotation: 0,
        floor,
      };
    }
  }
  return null;
}

function mkFurniture(
  type: import('../types').FurnitureType,
  x: number,
  y: number,
  w: number,
  l: number,
  floor: number,
  rotation: number,
): import('../types').FurnitureItem {
  return {
    id: genId('f'),
    type,
    name: type,
    x: round(x),
    y: round(y),
    width: round(w),
    length: round(l),
    rotation,
    floor,
  };
}

const OPPOSITE_WALL: Record<Wall, Wall> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/**
 * Best furniture corner: least total door-swing overlap (zero when the room
 * allows it). Shared by initial placement and post-nudge re-seating.
 */
function bestCorner(
  room: RoomRect,
  cw: number,
  cl: number,
  otherItems: { x: number; y: number; w: number; h: number }[] = [],
): { x: number; y: number } {
  const m = 0.5;
  const corners = [
    { x: room.x + m, y: room.y + m },
    { x: room.x + room.width - cw - m, y: room.y + m },
    { x: room.x + m, y: room.y + room.length - cl - m },
    { x: room.x + room.width - cw - m, y: room.y + room.length - cl - m },
  ];
  const swings = doorSwingRects(room);
  const scored = corners.map((c) => {
    const r = { x: c.x, y: c.y, w: cw, h: cl };
    let overlap = 0;
    for (const s of swings) {
      const ix = Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x);
      const iy = Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y);
      if (ix > 0 && iy > 0) overlap += ix * iy;
    }
    for (const o of otherItems) {
      const ix = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x);
      const iy = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y);
      if (ix > 0 && iy > 0) overlap += ix * iy * 1000;
    }
    return { c, overlap };
  });
  scored.sort((a, b) => a.overlap - b.overlap);
  return scored[0].c;
}

/**
 * After furniture is placed, slide any door whose swing overlaps furniture
 * along its wall to the first clear spot; when sliding fails, flip the hinge
 * (in-left ↔ in-right) so the arc clears the fixture. The mirrored twin door
 * on the neighbor moves with it so the pair stays aligned.
 */
function flipSwing(s: DoorMarker['swing']): DoorMarker['swing'] {
  if (s === 'in-left') return 'in-right';
  if (s === 'in-right') return 'in-left';
  if (s === 'out-left') return 'out-right';
  return 'out-left';
}

function nudgeDoorsClearOfFurniture(rooms: RoomRect[], furniture: import('../types').FurnitureItem[]): void {
  const furnByFloor = new Map<number, import('../types').FurnitureItem[]>();
  for (const f of furniture) {
    if (!furnByFloor.has(f.floor)) furnByFloor.set(f.floor, []);
    furnByFloor.get(f.floor)!.push(f);
  }
  const overlapsAny = (room: RoomRect, wall: Wall, pos: number): boolean => {
    const s = swingRectFor(room, wall, pos);
    return (furnByFloor.get(room.floor) || []).some(
      (f) =>
        f.x < s.x + s.w && f.x + f.width > s.x && f.y < s.y + s.h && f.y + f.length > s.y,
    );
  };
  // True when the door leaf at `pos` would open into a prohibited neighbor's
  // wall segment. Nudge slides must not trade a furniture overlap for a
  // hygiene/privacy violation (bath door sliding from the foyer segment onto
  // the living segment of one shared wall).
  const opensProhibited = (room: RoomRect, wall: Wall, pos: number, leafWidth: number): boolean => {
    const wallLen = wall === 'top' || wall === 'bottom' ? room.width : room.length;
    const half = leafWidth / 2 / Math.max(0.5, wallLen);
    for (const n of rooms) {
      if (n.id === room.id || n.floor !== room.floor) continue;
      if (!opensIntoProhibited(room.type, n.type)) continue;
      const overlap = sharedWallOverlap(room, n);
      if (!overlap || overlap.wall !== wall) continue;
      if (pos + half > overlap.lo && pos - half < overlap.hi) return true;
    }
    return false;
  };
  for (const r of rooms) {
    if (r.type === 'parking' || r.type === 'staircase') continue;
    for (const d of r.doors) {
      if (d.width > 4) continue; // shutters / wide openings stay put
      if (!overlapsAny(r, d.wall, d.pos)) continue;
      // find the mirrored twin (neighbor door on the opposite wall, mirrored pos)
      let twin: { room: RoomRect; door: DoorMarker } | null = null;
      for (const n of rooms) {
        if (n.id === r.id || n.floor !== r.floor) continue;
        if (sharedWallOf(r, n) !== d.wall) continue;
        const ow = OPPOSITE_WALL[d.wall];
        const t = n.doors.find((x) => x.wall === ow && Math.abs(x.pos - (1 - d.pos)) < 0.2);
        if (t) {
          twin = { room: n, door: t };
          break;
        }
      }
      let cleared = false;
      for (const delta of [0.3, -0.3, 0.25, -0.25, 0.2, -0.2, 0.15, -0.15, 0.1, -0.1, 0.05, -0.05]) {
        const np = Math.min(0.88, Math.max(0.12, Math.round((d.pos + delta) * 100) / 100));
        if (np === d.pos) continue;
        if (overlapsAny(r, d.wall, np)) continue;
        if (opensProhibited(r, d.wall, np, d.width)) continue;
        d.pos = np;
        if (twin) {
          twin.door.pos = Math.min(0.88, Math.max(0.12, Math.round((1 - np) * 100) / 100));
        }
        cleared = true;
        break;
      }
      if (!cleared) {
        // Sliding failed — flip the hinge so the swing arc clears the fixture
        // (bathroom door swinging through the commode is the reported case).
        const flipped = flipSwing(d.swing);
        d.swing = flipped;
        if (twin) twin.door.swing = flipSwing(twin.door.swing);
        // Re-seat bathroom fixtures opposite the final door wall.
        if (r.type === 'bathroom') reseatBathroomFixtures(r, furniture);
      }
    }
  }
}

/** Move bathroom fixtures (toilet) to the corner farthest from the door wall. */
function reseatBathroomFixtures(room: RoomRect, furniture: import('../types').FurnitureItem[]): void {
  const door = room.doors[0];
  if (!door) return;
  for (const f of furniture) {
    if (f.floor !== room.floor) continue;
    if (f.type !== 'toilet' && f.type !== 'vanity' && f.type !== 'shower' && f.type !== 'bathtub') continue;
    const cx = f.x + f.width / 2;
    const cy = f.y + f.length / 2;
    if (cx < room.x || cx > room.x + room.width || cy < room.y || cy > room.y + room.length) continue;
    const m = 0.5;
    const corners = [
      { x: room.x + m, y: room.y + m },
      { x: room.x + room.width - f.width - m, y: room.y + m },
      { x: room.x + m, y: room.y + room.length - f.length - m },
      { x: room.x + room.width - f.width - m, y: room.y + room.length - f.length - m },
    ];
    // Farthest corner from the door wall wins (toilet opposite the swing).
    const doorCx = door.wall === 'left' ? room.x : door.wall === 'right' ? room.x + room.width : room.x + door.pos * room.width;
    const doorCy = door.wall === 'top' ? room.y : door.wall === 'bottom' ? room.y + room.length : room.y + door.pos * room.length;
    corners.sort((a, b) => {
      const da = Math.hypot(a.x + f.width / 2 - doorCx, a.y + f.length / 2 - doorCy);
      const db = Math.hypot(b.x + f.width / 2 - doorCx, b.y + f.length / 2 - doorCy);
      return db - da;
    });
    const swings = doorSwingRects(room);
    for (const c of corners) {
      const r = { x: c.x, y: c.y, w: f.width, h: f.length };
      let overlap = 0;
      for (const s of swings) {
        const ix = Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x);
        const iy = Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y);
        if (ix > 0 && iy > 0) overlap += ix * iy;
      }
      if (overlap <= 0.01) {
        f.x = round(c.x);
        f.y = round(c.y);
        return;
      }
    }
    f.x = round(corners[0].x);
    f.y = round(corners[0].y);
  }
}

/** Guarantee a primary front entrance door on the road wall (ground floor). */
function ensureFrontEntrance(rooms: RoomRect[], plot: PlotConfig): void {
  const roadWall: Wall = plot.roadSide === 'north' ? 'top' : plot.roadSide === 'east' ? 'right' : plot.roadSide === 'west' ? 'left' : 'bottom';
  const ground = rooms.filter((r) => r.floor === 0 && r.type !== 'parking');
  if (ground.some((r) => r.doors.some((d) => d.wall === roadWall && d.width >= 3))) return;
  const candidates = ground
    .filter((r) => r.type === 'foyer' || r.type === 'living' || r.type === 'dining')
    .sort((a, b) => {
      const rank = (t: string) => (t === 'foyer' ? 0 : t === 'living' ? 1 : 2);
      if (rank(a.type) !== rank(b.type)) return rank(a.type) - rank(b.type);
      // Most-front room (closest to road) wins.
      const front = (r: RoomRect) =>
        plot.roadSide === 'south' ? r.y + r.length : plot.roadSide === 'north' ? -r.y : plot.roadSide === 'east' ? r.x + r.width : -r.x;
      return front(b) - front(a);
    });
  const host = candidates[0] || [...ground].sort((a, b) => b.width * b.length - a.width * a.length)[0];
  if (!host) return;
  const taken = new Set(host.doors.map((d) => d.wall));
  if (!taken.has(roadWall)) {
    host.doors.push({ wall: roadWall, pos: 0.5, width: 3.5, swing: 'out-right' });
  } else {
    host.doors.push({ wall: roadWall, pos: 0.5, width: 3.5, swing: 'out-right' });
  }
}

/** Attach one bathroom to the Master Bedroom with a private en-suite door. */
function ensureMasterEnSuite(rooms: RoomRect[]): void {
  const masters = rooms.filter((r) => r.name === 'Master Bedroom' || (r.type === 'bedroom' && r.name.startsWith('Master')));
  if (masters.length === 0) return;
  const master = masters[0];
  const sameFloor = rooms.filter((r) => r.floor === master.floor && r.id !== master.id);
  const baths = sameFloor.filter((r) => r.type === 'bathroom');
  if (baths.length === 0) return;
  const hasEnSuite = baths.some((b) => {
    const wall = sharedWallOf(master, b);
    return wall !== null && (master.doors.some((d) => d.wall === wall) || b.doors.some((d) => d.wall === (OPPOSITE_WALL as Record<string, Wall>)[wall]));
  });
  if (hasEnSuite) return;
  // Prefer an already-adjacent bath; else swap the nearest bath with the
  // smallest room currently adjacent to the master (never parking/living).
  let bath = baths
    .filter((b) => sharedWallOf(master, b) !== null)
    .sort((a, b) => a.width * a.length - b.width * b.length)[0];
  if (!bath) {
    const adjacent = sameFloor.filter((r) => sharedWallOf(master, r) !== null && r.type !== 'parking' && r.type !== 'living' && r.type !== 'kitchen');
    adjacent.sort((a, b) => a.width * a.length - b.width * b.length);
    const victim = adjacent[0];
    const nearest = [...baths].sort((a, b) => {
      const da = Math.hypot(a.x - master.x, a.y - master.y);
      const db = Math.hypot(b.x - master.x, b.y - master.y);
      return da - db;
    })[0];
    if (victim && nearest) {
      const rx = victim.x, ry = victim.y, rw = victim.width, rl = victim.length;
      victim.x = nearest.x; victim.y = nearest.y; victim.width = nearest.width; victim.length = nearest.length;
      nearest.x = rx; nearest.y = ry; nearest.width = rw; nearest.length = rl;
      bath = nearest;
    } else {
      bath = baths[0];
    }
  }
  const wall = sharedWallOf(master, bath);
  if (!wall) return;
  const ow = (OPPOSITE_WALL as Record<string, Wall>)[wall];
  if (!master.doors.some((d) => d.wall === wall)) {
    master.doors.push({ wall, pos: 0.5, width: 3, swing: 'in-right' });
  }
  if (!bath.doors.some((d) => d.wall === ow)) {
    bath.doors.push({ wall: ow, pos: 0.5, width: 3, swing: 'in-right' });
  }
}

function toScored(
  config: ProjectConfig,
  s: { choice: LayoutChoice; name: string; tagline: string },
  layout: LayoutData,
  extra?: { reasoning?: string; assumptions?: string[]; aiPlanned?: boolean },
): ScoredLayout {
  const score = scoreLayout(layout, config);
  const builtUp = layout.rooms.reduce((sum, r) => sum + r.width * r.length, 0);
  return {
    id: genId('d'),
    name: s.name,
    choice: s.choice,
    tagline: s.tagline,
    layout,
    score,
    builtUpArea: Math.round(builtUp),
    roomCount: layout.rooms.length,
    reasoning: extra?.reasoning,
    assumptions: extra?.assumptions,
    aiPlanned: extra?.aiPlanned,
  };
}

/** Human-readable label for a choice, e.g. "Stair left · kitchen rear-right". */
export function choiceLabel(c: LayoutChoice): string {
  const parts = [`Stair ${c.stairSlot}`, `kitchen ${c.kitchenCorner.replace('rear-', 'rear ')}`];
  if (c.bandOrder === 1) parts.push('service forward');
  if (c.mirror) parts.push('mirrored');
  return parts.join(' · ');
}

// Provisional variant set until Task 7's searchDesigns lands.
const PROVISIONAL_CHOICES: LayoutChoice[] = [
  DEFAULT_CHOICE,
  { ...DEFAULT_CHOICE, mirror: true },
  { ...DEFAULT_CHOICE, kitchenCorner: 'rear-right' },
  { ...DEFAULT_CHOICE, bandOrder: 1 },
  { ...DEFAULT_CHOICE, stairSlot: 'right' },
];

const designName = (i) => `Design ${String.fromCharCode(65 + i)}`;

/** Deterministic offline fallback (no AI). Used by tests + client fallback. */
export function generateDesignOptions(config: ProjectConfig): ScoredLayout[] {
  return PROVISIONAL_CHOICES.map((c, i) => {
    const layout = generateLayout(config, c);
    return toScored(config, { choice: c, name: designName(i), tagline: choiceLabel(c) }, layout, {
      assumptions: layout.assumptions,
      aiPlanned: false,
    });
  });
}

/**
 * AI-first variants: one shared AI plan (the brain) realized with several
 * layout choices (the ruler). Every design carries the AI reasoning.
 */
export function generateAIDesignOptions(
  config: ProjectConfig,
  aiPlan: AIPlan,
): { designs: ScoredLayout[]; reasoning: string; assumptions: string[] } {
  const designs = PROVISIONAL_CHOICES.map((c, i) => {
    const layout = generateLayout(config, c, aiPlan);
    return toScored(config, { choice: c, name: designName(i), tagline: choiceLabel(c) }, layout, {
      reasoning: aiPlan.reasoning,
      assumptions: [...aiPlan.assumptions, ...(layout.assumptions || [])],
      aiPlanned: true,
    });
  });
  return { designs, reasoning: aiPlan.reasoning, assumptions: aiPlan.assumptions };
}
