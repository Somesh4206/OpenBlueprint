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
    // Split rest into public (front) and private (rear)
    const splitH = rest.h * 0.5;
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
    // Two-zone split: public front, private rear
    const splitH = buildable.h * 0.5;
    const publicRect: Rect = roadIsSouthOrEast
      ? { x: buildable.x, y: buildable.y + buildable.h - splitH, w: buildable.w, h: splitH }
      : { x: buildable.x, y: buildable.y, w: buildable.w, h: splitH };
    const privateRect: Rect = roadIsSouthOrEast
      ? { x: buildable.x, y: buildable.y, w: buildable.w, h: buildable.h - splitH }
      : { x: buildable.x, y: buildable.y + splitH, w: buildable.w, h: buildable.h - splitH };
    for (const c of nonEmpty) {
      if (c.zone === 'public') c.rect = publicRect;
      else if (c.zone === 'private') c.rect = privateRect;
      else c.rect = publicRect; // circulation goes with public
    }
  } else {
    // Single zone or service-only: use full buildable
    for (const c of nonEmpty) c.rect = { ...buildable };
  }

  return nonEmpty;
}

// Place rooms within a zone cluster using BSP, sorted by privacy gradient.
export function placeZoneRooms(
  cluster: ZoneCluster,
  floor: number,
  plot: PlotConfig,
  strategy: LayoutStrategy,
): RoomRect[] {
  const rooms = cluster.rooms;
  if (rooms.length === 0) return [];

  // Sort by privacy order (most public first) so they cluster from the entry side
  const sorted = [...rooms].sort((a, b) => {
    const pa = PRIVACY_ORDER[a.type] ?? 5;
    const pb = PRIVACY_ORDER[b.type] ?? 5;
    return pa - pb;
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

function bspPackZone(rect: Rect, rooms: RoomRequirement[]): Placed[] {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) return [{ rect, req: rooms[0] }];

  // Split based on area ratios
  const targetAreas = rooms.map((r) => {
    const cat = ROOM_CATALOG[r.type];
    return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  });
  const total = targetAreas.reduce((a, b) => a + b, 0);

  let splitIdx = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < rooms.length; i++) {
    const acc = targetAreas.slice(0, i).reduce((a, b) => a + b, 0);
    const diff = Math.abs(acc / total - 0.5);
    if (diff < bestDiff) { bestDiff = diff; splitIdx = i; }
  }
  const leftRooms = rooms.slice(0, splitIdx);
  const rightRooms = rooms.slice(splitIdx);
  const leftArea = targetAreas.slice(0, splitIdx).reduce((a, b) => a + b, 0);
  const ratio = total > 0 ? leftArea / total : 0.5;

  const splitVertical = rect.w >= rect.h;
  let leftRect: Rect, rightRect: Rect;
  if (splitVertical) {
    let sw = rect.w * ratio;
    sw = Math.max(6, Math.min(rect.w - 6, sw));
    sw = Math.round(sw * 2) / 2;
    leftRect = { x: rect.x, y: rect.y, w: sw, h: rect.h };
    rightRect = { x: rect.x + sw, y: rect.y, w: rect.w - sw, h: rect.h };
  } else {
    let sh = rect.h * ratio;
    sh = Math.max(6, Math.min(rect.h - 6, sh));
    sh = Math.round(sh * 2) / 2;
    leftRect = { x: rect.x, y: rect.y, w: rect.w, h: sh };
    rightRect = { x: rect.x, y: rect.y + sh, w: rect.w, h: rect.h - sh };
  }

  return [...bspPackZone(leftRect, leftRooms), ...bspPackZone(rightRect, rightRooms)];
}

// Post-placement adjustment: try to swap rooms to satisfy desired adjacencies.
// This is a simple greedy pass — for each room with a desired adjacency, check
// if swapping it with a neighbor would improve adjacency satisfaction.
export function optimizeAdjacencies(rooms: RoomRect[]): RoomRect[] {
  let improved = [...rooms];
  let bestScore = scoreAdjacencies(improved);
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (let i = 0; i < improved.length; i++) {
      for (let j = i + 1; j < improved.length; j++) {
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
