import {
  LayoutData,
  LayoutStrategy,
  PlotConfig,
  ProjectConfig,
  RoomRect,
  RoomRequirement,
  ScoredLayout,
  DoorMarker,
  WindowMarker,
} from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { scoreLayout } from './scoring';
import { validateLayout } from './validation';
import { assignBands, optimizeAdjacencies, packRooms, placeZoneRooms } from '../architecture/planner';
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
      { plot: config.plot, floors: config.floors, rooms: [...others, ...rs], furniture: [], strategy: 'space-optimized' },
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
      const wall = sharedWallOf(r, o);
      if (!wall) continue;
      const di = r.doors.findIndex((d) => d.wall === wall);
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

// local id generator
let _idCounter = 0;
export function genId(prefix = 'r'): string {
  _idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${_idCounter}`;
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

// ---- Strategy bias: keeps the 5 design variants distinct ----
// Each strategy nudges within-zone ordering so variants genuinely differ
// while all still obey zone clustering + AI anchors + hard rules.
function strategyBias(r: RoomRequirement, strategy: LayoutStrategy): number {
  const cat = ROOM_CATALOG[r.type];
  const area = (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  switch (strategy) {
    case 'space-optimized':
      return -area / 1000; // big rooms first → tighter pack
    case 'ventilation-optimized': {
      const light: Record<string, number> = {
        balcony: 0, living: 1, bedroom: 2, kitchen: 3, dining: 3,
        pooja: 4, office: 4, foyer: 5, bathroom: 6, store: 7, utility: 7,
      };
      return (light[r.type] ?? 5) - area / 10000;
    }
    case 'modern-open': {
      const open: Record<string, number> = {
        foyer: 0, living: 1, dining: 2, kitchen: 3, balcony: 4,
      };
      return (open[r.type] ?? 5) - area / 10000;
    }
    case 'privacy-optimized': {
      const priv: Record<string, number> = {
        foyer: 0, living: 1, dining: 2, kitchen: 3, balcony: 3,
        office: 4, pooja: 4, store: 5, utility: 5, bathroom: 6, bedroom: 7,
      };
      return (priv[r.type] ?? 5) - area / 10000;
    }
    case 'vastu-optimized': {
      // SW (master bedroom) → SE (kitchen) → NE (pooja, living) → NW (bathroom, utility)
      const vastuOrder: Record<string, number> = {
        bedroom: 0, staircase: 1, kitchen: 2, pooja: 3, living: 4,
        foyer: 5, dining: 6, parking: 7, bathroom: 8, utility: 9,
        store: 10, office: 11, balcony: 12,
      };
      return vastuOrder[r.type] ?? 99;
    }
  }
}

/** Composite within-zone rank: AI anchor dominates, strategy breaks ties. */
export function orderRank(r: RoomRequirement, strategy: LayoutStrategy, anchor: number): number {
  return anchor * 1000 + strategyBias(r, strategy);
}

const STRATEGIES: { strategy: LayoutStrategy; name: string; tagline: string }[] = [
  { strategy: 'space-optimized', name: 'Design A', tagline: 'Space Optimized' },
  { strategy: 'ventilation-optimized', name: 'Design B', tagline: 'Ventilation Optimized' },
  { strategy: 'modern-open', name: 'Design C', tagline: 'Modern Open Layout' },
  { strategy: 'privacy-optimized', name: 'Design D', tagline: 'Privacy Optimized' },
  { strategy: 'vastu-optimized', name: 'Design E', tagline: 'Vastu Compliant' },
];

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
  // Single car bay: 9ft wide × 18ft deep (oriented per road side).
  const snap = (n: number) => Math.round(n * 2) / 2;
  if (roadSide === 'south' || roadSide === 'north') {
    const bw = Math.min(12, snap(buildable.w * 0.4));
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
  strategy: LayoutStrategy,
  floor: number,
  floorReqs: RoomRequirement[] = expandRequirements(config.rooms),
  aiPlan?: AIPlan,
): RoomRect[] {
  let buildable = buildableArea(config.plot, floor);
  // Structural: upper floors must sit on the ground load-bearing footprint.
  // The ground carves a parking bay + porch column at the road side; an upper
  // floor using the full buildable rect would float ~14ft over open yard.
  // Clamp upper floors to the ground house band so no habitable room cantilevers.
  if (floor > 0 && config.rooms.some((r) => r.type === 'parking')) {
    const groundCarve = carveParkingCorner(buildableArea(config.plot, 0), config.plot.roadSide);
    if (groundCarve) buildable = groundCarve.house;
  }
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
  const rankOf = (r: RoomRequirement) => orderRank(r, strategy, anchorRankOf(byName.get(r.name)));

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
  if (porchRect) {
    const porchArea = porchRect.w * porchRect.h;
    let used = 0;
    const rest: RoomRequirement[] = [];
    for (const r of orderedReqs) {
      const cat = ROOM_CATALOG[r.type];
      const pa = (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
      const isPublic = cat.group === 'public' || cat.group === 'circulation';
      if (isPublic && used + pa <= porchArea * 1.15) {
        porchReqs.push(r);
        used += pa;
      } else {
        rest.push(r);
      }
    }
    // BOND: kitchen and dining must stay together (serving link). If the
    // porch/house split separated them, move the straggler to rejoin its
    // partner. This prevents dining ending up next to parking while the
    // kitchen sits on the opposite side of the house.
    const porchHasDining = porchReqs.some((r) => r.type === 'dining');
    const porchHasKitchen = porchReqs.some((r) => r.type === 'kitchen');
    const restHasDining = rest.some((r) => r.type === 'dining');
    const restHasKitchen = rest.some((r) => r.type === 'kitchen');
    if (porchHasDining && restHasKitchen) {
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
      placed.push(...optimizeAdjacencies(packRooms(porchRect, porchReqs, floor)));
    }
  }

  // Front→rear band packing (AI Context §5). Each band gets a strip of the
  // house rect proportional to its summed preferred area; BSP runs inside
  // each strip. Bands tile houseRect exactly (last strip takes the
  // remainder, absorbing rounding). allocateZones stays exported for other
  // consumers but is no longer on this path.
  const bandGroups = assignBands(houseReqs, floor);
  const bandPref = (r: RoomRequirement) => {
    const cat = ROOM_CATALOG[r.type];
    return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  };
  const bandTotals = bandGroups.map((g) => g.reqs.reduce((s, r) => s + bandPref(r), 0));
  const bandGrand = bandTotals.reduce((a, b) => a + b, 0) || 1;
  const horizontal = config.plot.roadSide === 'south' || config.plot.roadSide === 'north';
  const fromHigh = config.plot.roadSide === 'south' || config.plot.roadSide === 'east';
  let cursor = fromHigh
    ? (horizontal ? houseRect.y + houseRect.h : houseRect.x + houseRect.w)
    : (horizontal ? houseRect.y : houseRect.x);
  bandGroups.forEach((g, i) => {
    const frac = bandTotals[i] / bandGrand;
    if (horizontal) {
      const depth = i === bandGroups.length - 1
        ? Math.abs(cursor - houseRect.y)
        : Math.round(houseRect.h * frac * 2) / 2;
      const rect: Rect = fromHigh
        ? { x: houseRect.x, y: cursor - depth, w: houseRect.w, h: depth }
        : { x: houseRect.x, y: cursor, w: houseRect.w, h: depth };
      cursor += fromHigh ? -depth : depth;
      placed.push(...optimizeAdjacencies(placeZoneRooms({ zone: 'public', rooms: g.reqs, rect }, floor, config.plot, strategy, rankOf)));
    } else {
      const depth = i === bandGroups.length - 1
        ? Math.abs(cursor - houseRect.x)
        : Math.round(houseRect.w * frac * 2) / 2;
      const rect: Rect = fromHigh
        ? { x: cursor - depth, y: houseRect.y, w: depth, h: houseRect.h }
        : { x: cursor, y: houseRect.y, w: depth, h: houseRect.h };
      cursor += fromHigh ? -depth : depth;
      placed.push(...optimizeAdjacencies(placeZoneRooms({ zone: 'public', rooms: g.reqs, rect }, floor, config.plot, strategy, rankOf)));
    }
  });

  // Step 3: (per-group adjacency optimization already applied above)
  out.push(...placed);

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
    if (r.type === 'parking') continue;
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
  // score improves, try pairwise rect swaps (tiling preserved: the rect set
  // is only permuted, so no void and no overlap can ever result; parking
  // never moves). Score = hard errors first, then ballooning, then warnings.
  repairGeometry(config, out, floor);

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

export function generateLayout(config: ProjectConfig, strategy: LayoutStrategy, aiPlan?: AIPlan): LayoutData {
  const rooms: RoomRect[] = [];
  const normalized = normalizeRequirements(config.rooms);
  const byFloor = distributeRoomsByFloor(normalized.reqs, config.floors, config.floorAssignment);
  if (aiPlan) applyPlanFloors(byFloor, aiPlan, config.floors);
  for (let f = 0; f < config.floors; f++) {
    const floorRooms = generateFloorLayout(config, strategy, f, byFloor[f] || [], aiPlan);
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
    strategy,
    reasoning: aiPlan?.reasoning,
    assumptions: normalized.assumptions,
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
  s: { strategy: LayoutStrategy; name: string; tagline: string },
  layout: LayoutData,
  extra?: { reasoning?: string; assumptions?: string[]; aiPlanned?: boolean },
): ScoredLayout {
  const score = scoreLayout(layout, config);
  const builtUp = layout.rooms.reduce((sum, r) => sum + r.width * r.length, 0);
  return {
    id: genId('d'),
    name: s.name,
    strategy: s.strategy,
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

/** Deterministic offline fallback (no AI). Used by tests + client fallback. */
export function generateDesignOptions(config: ProjectConfig): ScoredLayout[] {
  return STRATEGIES.map((s) => {
    const layout = generateLayout(config, s.strategy);
    return toScored(config, s, layout, { assumptions: layout.assumptions, aiPlanned: false });
  });
}

/**
 * AI-first variants: one shared AI plan (the brain) realized with 5
 * strategy emphases (the ruler). Every design carries the AI reasoning.
 */
export function generateAIDesignOptions(
  config: ProjectConfig,
  aiPlan: AIPlan,
): { designs: ScoredLayout[]; reasoning: string; assumptions: string[] } {
  const designs = STRATEGIES.map((s) => {
    const layout = generateLayout(config, s.strategy, aiPlan);
    return toScored(config, s, layout, {
      reasoning: aiPlan.reasoning,
      assumptions: [...aiPlan.assumptions, ...(layout.assumptions || [])],
      aiPlanned: true,
    });
  });
  return { designs, reasoning: aiPlan.reasoning, assumptions: aiPlan.assumptions };
}
