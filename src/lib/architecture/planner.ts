// Zone-based layout planner.
// Places rooms in zone clusters (public front, private rear, service side)
// and enforces adjacency requirements. Returns an adjacency map + zone clusters
// + coordinates.

import { RoomRect, RoomRequirement, RoomType, PlotConfig, LayoutStrategy } from '../types';
import { CAPPED_TYPES, ROOM_CATALOG } from '../room-catalog';
import { Zone, zoneOf, ZONE_PLACEMENT, PRIVACY_ORDER, DESIRED_ADJACENCY, PROHIBITED_ADJACENCY, areAdjacent } from './rules';
import { genId, round, Rect } from '../layout/engine';

export interface ZoneCluster {
  zone: Zone;
  rooms: RoomRequirement[];
  rect: Rect; // allocated region for this zone
}

export interface PlannerResult {
  rooms: RoomRect[];
  zones: ZoneCluster[];
  adjacencyMap: Record<string, string[]>; // roomId → [adjacent roomIds]
}

// Front→rear band map per floor class (AI Context §5). Unmapped types fall
// into the last band (rear/service) — deterministic, never silent.
export const BAND_MAP: Record<string, RoomRequirement['type'][]> = {
  'ground-entry': ['foyer', 'living'],
  'ground-social': ['dining', 'bathroom'],
  'ground-service': ['kitchen', 'utility', 'store'],
  'ground-private': ['bedroom', 'pooja', 'office'],
  'upper-front': ['balcony', 'foyer'],
  'upper-rear': ['bedroom', 'bathroom', 'pooja', 'office'],
};

export function assignBands(reqs: RoomRequirement[], floor: number): { band: string; reqs: RoomRequirement[] }[] {
  const order = floor === 0
    ? ['ground-entry', 'ground-social', 'ground-service', 'ground-private']
    : ['upper-front', 'upper-rear'];
  const groups = order.map((band) => ({ band, reqs: [] as RoomRequirement[] }));
  const at = (band: string) => groups.find((g) => g.band === band)!;
  for (const r of reqs) {
    // Parking never drops out: ground service band, or the upper-front
    // lobby band when a custom split puts it upstairs (the validator then
    // judges the prohibited parking↔bedroom adjacency explicitly).
    if (r.type === 'parking') {
      at(floor === 0 ? 'ground-service' : 'upper-front').reqs.push(r);
      continue;
    }
    const idx = order.findIndex((b) => (BAND_MAP[b] || []).includes(r.type));
    groups[idx < 0 ? groups.length - 1 : idx].reqs.push(r);
  }
  return groups.filter((g) => g.reqs.length > 0);
}

// Minimum workable band-strip depth. A thinner strip cannot hold any room
// and manufactures slivers — the engine merges such bands into a neighbor.
export const MIN_BAND_DEPTH = 6.5;

// Allocate zone regions within the buildable area.
// public → front (near road), private → rear, service → side, circulation → center.
export function allocateZones(
  buildable: Rect,
  reqs: RoomRequirement[],
  plot: PlotConfig,
): ZoneCluster[] {
  // Merge circulation zone into public zone (staircase goes with public cluster)
  const zonesPresent: Zone[] = ['public', 'service', 'private'];
  const clusters: ZoneCluster[] = zonesPresent.map((z) => ({
    zone: z,
    rooms: [],
    rect: { ...buildable },
  }));

  // Group requirements by zone (circulation → public)
  for (const r of reqs) {
    let z = zoneOf(r.type);
    if (z === 'circulation') z = 'public'; // merge circulation into public
    const cluster = clusters.find((c) => c.zone === z);
    if (cluster) cluster.rooms.push(r);
  }

  // Remove empty zones
  const nonEmpty = clusters.filter((c) => c.rooms.length > 0);

  // Determine split strategy based on which zones are present
  const hasPublic = nonEmpty.some((c) => c.zone === 'public');
  const hasPrivate = nonEmpty.some((c) => c.zone === 'private');
  const hasService = nonEmpty.some((c) => c.zone === 'service');
  const hasCirc = nonEmpty.some((c) => c.zone === 'circulation');

  // Road side determines "front". For south road (default), front = high Y (bottom).
  // We'll split the buildable area into regions.
  const roadIsSouthOrEast = plot.roadSide === 'south' || plot.roadSide === 'east';

  if (hasService && hasPublic && hasPrivate) {
    // Three-zone split: service on one side, public in front, private in rear.
    // Take a service strip on the side away from the main entry.
    const serviceDepth = Math.min(buildable.w * 0.3, 12);
    const serviceRect: Rect = {
      x: buildable.x + buildable.w - serviceDepth,
      y: buildable.y,
      w: serviceDepth,
      h: buildable.h,
    };
    const rest: Rect = {
      x: buildable.x,
      y: buildable.y,
      w: buildable.w - serviceDepth,
      h: buildable.h,
    };
    // Split rest into public (front) and private (rear), area-proportional
    // so a tiny zone doesn't swallow half the floor.
    const zoneArea = (z: Zone) =>
      nonEmpty.find((c) => c.zone === z)?.rooms.reduce((s, r) => {
        const cat = ROOM_CATALOG[r.type];
        return s + (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
      }, 0) || 0;
    const pA = zoneArea('public');
    const rA = zoneArea('private');
    const rRatio = pA + rA > 0 ? rA / (pA + rA) : 0.5;
    const splitH = Math.round(rest.h * (1 - Math.min(0.7, Math.max(0.2, rRatio))) * 2) / 2;
    // Guard: if either strip would be a ribbon (< 6.5ft deep — no room can
    // live in it), don't zone-split at all. One ordered pack beats two
    // ribbons; the privacy sort inside still keeps public toward entry.
    if (Math.min(splitH, rest.h - splitH) < 6.5) {
      return [{ zone: 'public', rooms: [...nonEmpty.flatMap((c) => c.rooms)], rect: { ...buildable } }];
    }
    const publicRect: Rect = roadIsSouthOrEast
      ? { x: rest.x, y: rest.y + rest.h - splitH, w: rest.w, h: splitH }   // front = bottom (south)
      : { x: rest.x, y: rest.y, w: rest.w, h: splitH };                     // front = top (north)
    const privateRect: Rect = roadIsSouthOrEast
      ? { x: rest.x, y: rest.y, w: rest.w, h: rest.h - splitH }
      : { x: rest.x, y: rest.y + splitH, w: rest.w, h: rest.h - splitH };

    for (const c of nonEmpty) {
      if (c.zone === 'public') c.rect = publicRect;
      else if (c.zone === 'private') c.rect = privateRect;
      else if (c.zone === 'service') c.rect = serviceRect;
      else c.rect = { x: rest.x + rest.w * 0.4, y: rest.y + rest.h * 0.4, w: rest.w * 0.2, h: rest.h * 0.2 };
    }
  } else if (hasPublic && hasPrivate) {
    // Two-zone split: public front, private rear — sized by each zone's
    // total preferred area (a lone powder room must NOT get half the floor).
    const areaOf = (z: Zone) =>
      nonEmpty.find((c) => c.zone === z)?.rooms.reduce((s, r) => {
        const cat = ROOM_CATALOG[r.type];
        return s + (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
      }, 0) || 0;
    const pubArea = areaOf('public');
    const privArea = areaOf('private');
    const privRatio = pubArea + privArea > 0 ? privArea / (pubArea + privArea) : 0.5;
    const clamped = Math.min(0.7, Math.max(0.2, privRatio));
    const splitH = Math.round(buildable.h * (1 - clamped) * 2) / 2;
    // Same ribbon guard as the 3-zone branch: no strip under 6.5ft deep.
    if (Math.min(splitH, buildable.h - splitH) < 6.5) {
      return [{ zone: 'public', rooms: [...nonEmpty.flatMap((c) => c.rooms)], rect: { ...buildable } }];
    }
    const publicRect: Rect = roadIsSouthOrEast
      ? { x: buildable.x, y: buildable.y + buildable.h - splitH, w: buildable.w, h: splitH }
      : { x: buildable.x, y: buildable.y, w: buildable.w, h: splitH };
    const privateRect: Rect = roadIsSouthOrEast
      ? { x: buildable.x, y: buildable.y, w: buildable.w, h: buildable.h - splitH }
      : { x: buildable.x, y: buildable.y + splitH, w: buildable.w, h: buildable.h - splitH };
    for (const c of nonEmpty) {
      if (c.zone === 'public') c.rect = publicRect;
      else if (c.zone === 'private') c.rect = privateRect;
      else c.rect = publicRect; // circulation/service go with public
    }
  } else if (hasService && hasPublic) {
    // Public + Service (no private on this floor): service on side, public gets the rest
    const serviceDepth = Math.min(buildable.w * 0.25, 10);
    const serviceRect: Rect = { x: buildable.x + buildable.w - serviceDepth, y: buildable.y, w: serviceDepth, h: buildable.h };
    const publicRect: Rect = { x: buildable.x, y: buildable.y, w: buildable.w - serviceDepth, h: buildable.h };
    for (const c of nonEmpty) {
      if (c.zone === 'service') c.rect = serviceRect;
      else c.rect = publicRect;
    }
  } else if (hasService && hasPrivate) {
    // Private + Service (no public): service on side, private gets the rest
    const serviceDepth = Math.min(buildable.w * 0.25, 10);
    const serviceRect: Rect = { x: buildable.x + buildable.w - serviceDepth, y: buildable.y, w: serviceDepth, h: buildable.h };
    const privateRect: Rect = { x: buildable.x, y: buildable.y, w: buildable.w - serviceDepth, h: buildable.h };
    for (const c of nonEmpty) {
      if (c.zone === 'service') c.rect = serviceRect;
      else c.rect = privateRect;
    }
  } else {
    // Single zone or service-only: use full buildable
    for (const c of nonEmpty) c.rect = { ...buildable };
  }

  return nonEmpty;
}

// Place rooms within a zone cluster using BSP.
// Order: AI anchor rank first (when provided), then LARGEST-first
// (classic decreasing-fit: big rooms claim clean slabs, small rooms fill
// the cracks — privacy-gradient ordering instead packed kitchens into
// slivers while bedrooms hogged space they didn't need).
export function placeZoneRooms(
  cluster: ZoneCluster,
  floor: number,
  plot: PlotConfig,
  anchorRank?: (r: RoomRequirement) => number,
): RoomRect[] {
  const rooms = cluster.rooms;
  if (rooms.length === 0) return [];

  const area = (r: RoomRequirement) => {
    const cat = ROOM_CATALOG[r.type];
    return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  };
  const sorted = [...rooms].sort((a, b) => {
    if (anchorRank) {
      const ra = anchorRank(a);
      const rb = anchorRank(b);
      if (ra !== rb) return ra - rb;
    }
    return area(b) - area(a);
  });

  // BSP pack within the zone rect
  const placed = bspPackZone(cluster.rect, sorted);
  const out: RoomRect[] = [];
  for (const p of placed) {
    const cat = ROOM_CATALOG[p.req.type];
    const roomRect: RoomRect = {
      id: genId(),
      type: p.req.type,
      name: p.req.name || cat.defaultName,
      x: round(p.rect.x),
      y: round(p.rect.y),
      width: round(p.rect.w),
      length: round(p.rect.h),
      floor,
      doors: [],
      windows: [],
    };
    out.push(roomRect);
  }
  return out;
}

interface Placed { rect: Rect; req: RoomRequirement; }

function prefArea(r: RoomRequirement): number {
  const cat = ROOM_CATALOG[r.type];
  return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
}

function minArea(r: RoomRequirement): number {
  const cat = ROOM_CATALOG[r.type];
  return (r.minWidth || cat.minWidth) * (r.minLength || cat.minLength);
}

/**
 * Area-proportioned BSP that fills `rect` with ZERO void and respects
 * minimum sizes: when the room list doesn't fit at preferred sizes, every
 * target shrinks toward its minimum (never below) instead of crushing a
 * few rooms into slivers. Split sides are clamped so each side can hold
 * its rooms' total minimum area whenever physically possible.
 */
export function packRect(rect: Rect, rooms: RoomRequirement[]): Placed[] {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) return [{ rect, req: rooms[0] }];

  // BOND: ensure kitchen and dining are adjacent in the input array so BSP
  // never splits them to opposite sides. Move dining right after kitchen
  // (or vice versa) before the area-balanced split below.
  const sorted = [...rooms];
  const ki = sorted.findIndex((r) => r.type === 'kitchen');
  const di = sorted.findIndex((r) => r.type === 'dining');
  if (ki >= 0 && di >= 0 && Math.abs(ki - di) > 1) {
    const [dining] = sorted.splice(di, 1);
    const newKi = sorted.findIndex((r) => r.type === 'kitchen');
    sorted.splice(newKi + 1, 0, dining); // insert dining right after kitchen
  }

  const rectArea = Math.max(1, rect.w * rect.h);
  const prefs = sorted.map(prefArea);
  const mins = sorted.map(minArea);
  const totalPref = prefs.reduce((a, b) => a + b, 0);
  const totalMin = mins.reduce((a, b) => a + b, 0);
  const scale = totalPref > 0 ? Math.min(1, rectArea / totalPref) : 1;
  const targets = sorted.map((_, i) => Math.max(mins[i], prefs[i] * scale));
  // Absorber: leftover space concentrates in social rooms (living first),
  // NEVER in kitchen/bath/store. Without this, a lone dining room balloons
  // to parking size and kitchens outgrow living rooms.
  const ABSORB_ORDER = [
    'living', 'dining', 'foyer', 'balcony', 'bedroom', 'office', 'pooja',
    'store', 'utility', 'kitchen', 'bathroom', 'parking', 'staircase',
  ];
  let absorber = -1;
  let absorberRank = Infinity;
  sorted.forEach((r, i) => {
    const rank = ABSORB_ORDER.indexOf(r.type);
    if (rank >= 0 && rank < absorberRank) {
      absorberRank = rank;
      absorber = i;
    }
  });
  if (absorber >= 0 && sorted.length > 1) {
    const othersCapped = targets.reduce(
      (s, t, i) => (i === absorber ? s : s + Math.min(t, prefs[i] * 1.5)),
      0,
    );
    const absorberMax = ROOM_CATALOG[sorted[absorber].type].maxArea;
    const inflated = Math.min(
      absorberMax, // leftover never stretches a room past its cap
      Math.max(targets[absorber], rectArea - othersCapped),
    );
    if (inflated > targets[absorber]) targets[absorber] = inflated;
  }
  // Absolute caps (AI Context §6): no pack target may exceed its catalog
  // maximum. Leftover area belongs to circulation/balcony/open-to-sky.
  for (let i = 0; i < sorted.length; i++) {
    const cap = ROOM_CATALOG[sorted[i].type].maxArea;
    if (targets[i] > cap) targets[i] = cap;
  }
  const totalTarget = targets.reduce((a, b) => a + b, 0);

  // Aspect-aware split selection: evaluate every (index, orientation) pair.
  // Cost = area imbalance + thin-child penalty (a child strip under 6.5ft
  // deep strands its rooms as slivers) + kitchen-dining bond penalty.
  // Deterministic: fixed evaluation order, strict improvement only.
  const MIN_SIDE = 4; // small baths/pooja/store legally fit 4ft
  const bondPenalty = (i: number): number => {
    const leftTypes = sorted.slice(0, i).map((r) => r.type);
    const rightTypes = sorted.slice(i).map((r) => r.type);
    const kitchenDiningSplit =
      (leftTypes.includes('kitchen') && rightTypes.includes('dining')) ||
      (leftTypes.includes('dining') && rightTypes.includes('kitchen'));
    return kitchenDiningSplit ? 0.5 : 0; // heavy penalty
  };
  // A side holding exactly one room is scored exactly: that room's area
  // overflow and aspect violation in the child rect (capped types only —
  // uncapped rooms never fail). Multiroom sides keep the thin-strip
  // heuristic, applied only when they hold capped rooms.
  const sideCost = (w: number, h: number, side: RoomRequirement[]): number => {
    if (side.length === 1) {
      const cat = ROOM_CATALOG[side[0].type];
      if (!CAPPED_TYPES.has(side[0].type)) return 0;
      const area = Math.max(0.5, w) * Math.max(0.5, h);
      let cost = 0;
      if (area > cat.maxArea + 0.5) cost += 10 + (area - cat.maxArea) / 10;
      const aspect = Math.max(w, h) / Math.max(0.5, Math.min(w, h));
      if (aspect > cat.maxAspect + 0.05) cost += 10 + (aspect - cat.maxAspect) * 5;
      return cost;
    }
    if (!side.some((r) => CAPPED_TYPES.has(r.type))) return 0;
    const thin = Math.min(w, h);
    // Thin strips doom their rooms: 24x1-style slivers come from here.
    if (thin < MIN_SIDE) return 10 + (MIN_SIDE - thin);
    if (thin < MIN_BAND_DEPTH) return 1 + (MIN_BAND_DEPTH - thin) / MIN_BAND_DEPTH;
    return 0;
  };
  let splitIdx = 1;
  let splitVertical = rect.w >= rect.h;
  let bestCost = Infinity;
  let bestMinDim = -Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const acc = targets.slice(0, i).reduce((a, b) => a + b, 0);
    const balance = totalTarget > 0 ? Math.abs(acc / totalTarget - 0.5) : 0.5;
    for (const vertical of [true, false]) {
      const span = vertical ? rect.w : rect.h;
      // Both children keep at least MIN_SIDE (legacy single-side clamp);
      // degenerate spans still tile so tiny rooms never error here.
      let d = span * (totalTarget > 0 ? acc / totalTarget : 0.5);
      d = Math.max(MIN_SIDE, Math.min(span - MIN_SIDE, d));
      d = Math.round(d * 2) / 2;
      const c1 = vertical ? { w: d, h: rect.h } : { w: rect.w, h: d };
      const c2 = vertical ? { w: span - d, h: rect.h } : { w: rect.w, h: span - d };
      const cost =
        balance +
        sideCost(c1.w, c1.h, sorted.slice(0, i)) +
        sideCost(c2.w, c2.h, sorted.slice(i)) +
        bondPenalty(i);
      // Tie-break: squarer children tile better downstream (a 15x7 + 15x7
      // split keeps every option open; 10.4x14 + 3.6x14 dooms a side).
      const minDim = Math.min(
        Math.min(c1.w, c1.h),
        Math.min(c2.w, c2.h),
      );
      if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) <= 1e-9 && minDim > bestMinDim)) {
        bestCost = cost;
        bestMinDim = minDim;
        splitIdx = i;
        splitVertical = vertical;
      }
    }
  }
  const leftRooms = sorted.slice(0, splitIdx);
  const rightRooms = sorted.slice(splitIdx);
  const leftTarget = targets.slice(0, splitIdx).reduce((a, b) => a + b, 0);
  const leftMin = mins.slice(0, splitIdx).reduce((a, b) => a + b, 0);
  const rightMin = mins.slice(splitIdx).reduce((a, b) => a + b, 0);
  let ratio = totalTarget > 0 ? leftTarget / totalTarget : 0.5;
  // Clamp: neither side may be smaller than its rooms' minimum footprint.
  const minRatio = totalMin > 0 ? leftMin / Math.max(totalMin, rectArea) : 0.15;
  const maxRatio = totalMin > 0 ? 1 - rightMin / Math.max(totalMin, rectArea) : 0.85;
  ratio = Math.min(Math.max(ratio, Math.min(minRatio, 0.85)), Math.max(maxRatio, 0.15));
  ratio = Math.min(0.85, Math.max(0.15, ratio));

  let leftRect: Rect, rightRect: Rect;
  if (splitVertical) {
    let sw = rect.w * ratio;
    sw = Math.max(MIN_SIDE, Math.min(rect.w - MIN_SIDE, sw));
    sw = Math.round(sw * 2) / 2;
    leftRect = { x: rect.x, y: rect.y, w: sw, h: rect.h };
    rightRect = { x: rect.x + sw, y: rect.y, w: rect.w - sw, h: rect.h };
  } else {
    let sh = rect.h * ratio;
    sh = Math.max(MIN_SIDE, Math.min(rect.h - MIN_SIDE, sh));
    sh = Math.round(sh * 2) / 2;
    leftRect = { x: rect.x, y: rect.y, w: rect.w, h: sh };
    rightRect = { x: rect.x, y: rect.y + sh, w: rect.w, h: rect.h - sh };
  }

  return [...packRect(leftRect, leftRooms), ...packRect(rightRect, rightRooms)];
}

/** Pack rooms into any rect and convert to RoomRects (no zone splitting). */
export function packRooms(rect: Rect, reqs: RoomRequirement[], floor: number): RoomRect[] {
  return packRect(rect, reqs).map((p) => {
    const cat = ROOM_CATALOG[p.req.type];
    return {
      id: genId(),
      type: p.req.type,
      name: p.req.name || cat.defaultName,
      x: round(p.rect.x),
      y: round(p.rect.y),
      width: round(p.rect.w),
      length: round(p.rect.h),
      floor,
      doors: [],
      windows: [],
    };
  });
}

function bspPackZone(rect: Rect, rooms: RoomRequirement[]): Placed[] {
  return packRect(rect, rooms);
}

// Post-placement adjustment: try to swap rooms to satisfy desired adjacencies.
// Only swaps rooms WITHIN THE SAME ZONE to preserve zone clustering.
export function countCapViolations(rs: { type: RoomRect['type']; width: number; length: number }[]): number {
  // Cap violations a swap would create (capped types only). A swap that
  // manufactures a sliver to gain an adjacency point is never worth it.
  let n = 0;
  for (const r of rs) {
    if (!CAPPED_TYPES.has(r.type)) continue;
    const cat = ROOM_CATALOG[r.type];
    if (r.width * r.length > cat.maxArea + 0.5) n++;
    const aspect = Math.max(r.width, r.length) / Math.max(0.5, Math.min(r.width, r.length));
    if (aspect > cat.maxAspect + 0.05) n++;
  }
  return n;
}

export function optimizeAdjacencies(rooms: RoomRect[]): RoomRect[] {
  const capViolations = countCapViolations;
  let improved = [...rooms];
  let bestScore = scoreAdjacencies(improved);
  let bestCaps = capViolations(improved);
  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    for (let i = 0; i < improved.length; i++) {
      for (let j = i + 1; j < improved.length; j++) {
        // only swap rooms in the same zone
        if (zoneOf(improved[i].type) !== zoneOf(improved[j].type)) continue;
        // never swap a room into a slot smaller than its catalog minimum —
        // swaps that manufacture slivers (e.g. living into a 3.5ft slot) hurt
        // far more than any adjacency point is worth.
        const catA = ROOM_CATALOG[improved[i].type];
        const catB = ROOM_CATALOG[improved[j].type];
        if (
          trialSizeOk(improved[j], catA) === false ||
          trialSizeOk(improved[i], catB) === false
        ) continue;
        // swap positions
        const trial = [...improved];
        const a = { ...trial[i], x: trial[j].x, y: trial[j].y, width: trial[j].width, length: trial[j].length };
        const b = { ...trial[j], x: improved[i].x, y: improved[i].y, width: improved[i].width, length: improved[i].length };
        trial[i] = a;
        trial[j] = b;
        if (capViolations(trial) > bestCaps) continue;
        const trialScore = scoreAdjacencies(trial);
        if (trialScore > bestScore) {
          improved = trial;
          bestScore = trialScore;
          bestCaps = capViolations(trial);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return improved;
}

/** Would `room`'s slot satisfy `cat` minimum dimensions? */
function trialSizeOk(
  slot: { width: number; length: number },
  cat: { minWidth: number; minLength: number },
): boolean {
  return slot.width >= cat.minWidth - 0.5 && slot.length >= cat.minLength - 0.5;
}

// Score how well a layout satisfies desired + prohibited adjacencies.
export function scoreAdjacencies(rooms: RoomRect[]): number {
  let score = 0;
  for (const r of rooms) {
    const desired = DESIRED_ADJACENCY[r.type] || [];
    for (const t of desired) {
      if (rooms.some((o) => o.id !== r.id && o.type === t && o.floor === r.floor && areAdjacent(r, o))) {
        score += 2;
      }
    }
    const prohibited = PROHIBITED_ADJACENCY[r.type] || [];
    for (const t of prohibited) {
      if (rooms.some((o) => o.id !== r.id && o.type === t && o.floor === r.floor && areAdjacent(r, o))) {
        score -= 3;
      }
    }
  }
  return score;
}
