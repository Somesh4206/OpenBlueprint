// Zone-based layout planner.
// Places rooms in zone clusters (public front, private rear, service side)
// and enforces adjacency requirements. Returns an adjacency map + zone clusters
// + coordinates.

import { RoomRect, RoomRequirement, RoomType, PlotConfig, LayoutStrategy } from '../types';
import { ROOM_CATALOG } from '../room-catalog';
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
  strategy: LayoutStrategy,
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
    const inflated = Math.min(
      prefs[absorber] * 2.5,  // was 3×; 2.5× stops 855 sqft master bedrooms
      Math.max(targets[absorber], rectArea - othersCapped),
    );
    if (inflated > targets[absorber]) targets[absorber] = inflated;
  }
  // Per-type inflation caps: prevent individual rooms from ballooning beyond
  // reasonable multiples of their preferred area. A bathroom should never be
  // 117 sqft (18' long) and a master bedroom should never be 855 sqft.
  const TYPE_MAX_INFLATION: Record<string, number> = {
    bathroom: 1.8,
    kitchen: 1.8,
    store: 1.8,
    utility: 1.8,
    pooja: 1.8,
    bedroom: 2.0,
    dining: 2.0,
    office: 2.0,
    living: 2.5,  // living is the most flexible
    foyer: 2.0,
    balcony: 1.8,
    parking: 1.5,
  };
  for (let i = 0; i < sorted.length; i++) {
    const maxMul = TYPE_MAX_INFLATION[sorted[i].type] ?? 2.0;
    const cap = prefs[i] * maxMul;
    if (targets[i] > cap) targets[i] = cap;
  }
  const totalTarget = targets.reduce((a, b) => a + b, 0);

  // Find the best split index. Penalize splits that separate kitchen from
  // dining (bonded pair) — prefer a split that keeps them on the same side.
  let splitIdx = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const acc = targets.slice(0, i).reduce((a, b) => a + b, 0);
    let diff = Math.abs(acc / totalTarget - 0.5);
    // Penalize splits that break kitchen-dining bond
    const leftTypes = sorted.slice(0, i).map((r) => r.type);
    const rightTypes = sorted.slice(i).map((r) => r.type);
    const kitchenDiningSplit =
      (leftTypes.includes('kitchen') && rightTypes.includes('dining')) ||
      (leftTypes.includes('dining') && rightTypes.includes('kitchen'));
    if (kitchenDiningSplit) diff += 0.5; // heavy penalty
    if (diff < bestDiff) { bestDiff = diff; splitIdx = i; }
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

  const splitVertical = rect.w >= rect.h;
  const MIN_SIDE = 4; // small baths/pooja/store legally fit 4ft
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
export function optimizeAdjacencies(rooms: RoomRect[]): RoomRect[] {
  let improved = [...rooms];
  let bestScore = scoreAdjacencies(improved);
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
        const trialScore = scoreAdjacencies(trial);
        if (trialScore > bestScore) {
          improved = trial;
          bestScore = trialScore;
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
