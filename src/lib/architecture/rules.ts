// Architectural rules — zone classification, adjacency graph, minimum standards.
// These are the NON-NEGOTIABLE constraints that the layout engine must satisfy.

import { RoomType } from '../types';

// =========================================================================
// 1. ZONE CLASSIFICATION
// Every room belongs to exactly one zone.
// =========================================================================
export type Zone = 'public' | 'private' | 'service' | 'circulation';

export const ZONE_OF: Record<RoomType, Zone> = {
  living: 'public',
  dining: 'public',
  kitchen: 'public', // kitchen bridges public and service but is placed in public zone
  foyer: 'public',
  bedroom: 'private',
  bathroom: 'private',
  office: 'private',
  pooja: 'private',
  parking: 'service',
  utility: 'service',
  store: 'service',
  staircase: 'circulation',
  balcony: 'public',
};

export function zoneOf(type: RoomType): Zone {
  return ZONE_OF[type] || 'public';
}

// =========================================================================
// 2. ADJACENCY REQUIREMENTS (hard constraints)
// desiredAdjacency[A] = list of room types A must be adjacent to (at least one)
// prohibitedAdjacency[A] = list of room types A must NOT be adjacent to
// =========================================================================
export const DESIRED_ADJACENCY: Record<string, RoomType[]> = {
  kitchen: ['dining', 'living'],        // kitchen MUST be adjacent to dining and/or living
  dining: ['kitchen', 'living'],        // dining adjacent to kitchen and/or living
  living: ['dining', 'kitchen'],        // living adjacent to dining/kitchen
  bathroom: ['bedroom'],                // bathrooms near bedrooms they serve
  pooja: ['living', 'dining'],          // pooja near living/dining
  store: ['kitchen'],                   // store/pantry near kitchen
  utility: ['kitchen', 'bathroom'],     // utility near kitchen/bath
  staircase: ['living', 'foyer'],       // staircase accessible from living/foyer
};

export const PROHIBITED_ADJACENCY: Record<string, RoomType[]> = {
  parking: ['bedroom'],     // garage NOT directly adjacent to bedrooms (noise/fume)
  bathroom: ['living', 'dining', 'kitchen'],  // bathroom not opening directly into living areas
  kitchen: ['bathroom'],    // kitchen not adjacent to bathroom
};

// Rooms that SHOULD be adjacent if both present (soft preference)
export const SOFT_ADJACENCY: Record<string, RoomType[]> = {
  bedroom: ['bathroom'],   // master bedroom + attached bath
  living: ['foyer', 'balcony'],
  dining: ['balcony'],
};

// =========================================================================
// 3. MINIMUM CODE STANDARDS (in feet; converted from metric)
// 1 m = 3.281 ft.  9.5 m² = 102.3 sqft,  2.4 m = 7.87 ft, etc.
// =========================================================================
export interface MinStandard {
  minArea: number;   // sq.ft
  minWidth: number;  // ft
  label: string;
}

export const MIN_STANDARDS: Record<string, MinStandard> = {
  bedroom: { minArea: 80, minWidth: 8, label: 'Habitable room (bedroom) min 9.5 m² / 2.4 m width' },
  living: { minArea: 102, minWidth: 8, label: 'Primary habitable room min 9.5 m² / 2.4 m width' },
  dining: { minArea: 80, minWidth: 7, label: 'Dining min 7.5 m² / 2.1 m width' },
  kitchen: { minArea: 54, minWidth: 6, label: 'Kitchen min 5.0 m² / 1.8 m width' },
  bathroom: { minArea: 20, minWidth: 4, label: 'Bathroom min 1.8 m²' },
  office: { minArea: 54, minWidth: 7, label: 'Study/office min 5.0 m² / 2.1 m width' },
  pooja: { minArea: 16, minWidth: 4, label: 'Pooja min 1.5 m²' },
  parking: { minArea: 162, minWidth: 9, label: 'Parking min 9×18 ft' },
  utility: { minArea: 32, minWidth: 5, label: 'Utility min 3.0 m²' },
  store: { minArea: 16, minWidth: 4, label: 'Store min 1.5 m²' },
  staircase: { minArea: 60, minWidth: 6, label: 'Staircase min 3 ft wide' },
  foyer: { minArea: 20, minWidth: 5, label: 'Foyer min 1.8 m²' },
  balcony: { minArea: 24, minWidth: 4, label: 'Balcony min 2.2 m²' },
};

// At least one room must be >= 9.5 m² (102 sqft)
export const PRIMARY_ROOM_MIN_AREA = 102;

// =========================================================================
// 4. ZONE PLACEMENT PREFERENCES (for the planner)
// Where each zone should sit relative to the plot.
// "front" = near the road (high Y in our coords, y-down)
// "rear" = away from road (low Y)
// "side" = along side walls
// =========================================================================
export const ZONE_PLACEMENT: Record<Zone, 'front' | 'rear' | 'center' | 'side'> = {
  public: 'front',       // entry, living, dining near the road
  private: 'rear',       // bedrooms away from street noise
  service: 'side',       // garage, utility at the service edge
  circulation: 'center', // staircase, hallway in the middle
};

// =========================================================================
// 5. PRIVACY GRADIENT
// Order from most public to most private. The planner arranges rooms
// along this gradient from front (road) to rear.
// =========================================================================
export const PRIVACY_ORDER: Record<string, number> = {
  foyer: 0,        // most public
  parking: 1,
  living: 2,
  dining: 3,
  kitchen: 4,
  balcony: 4,
  staircase: 5,
  pooja: 5,
  office: 6,
  store: 6,
  utility: 6,
  bathroom: 7,
  bedroom: 8,      // most private
};

// =========================================================================
// 6. PROHIBITED MISTAKES (the planner must never produce these)
// =========================================================================
export interface ProhibitionRule {
  id: string;
  description: string;
  // returns true if the prohibition is VIOLATED
  check: (ctx: ProhibitionContext) => boolean;
}

export interface ProhibitionContext {
  rooms: { id: string; type: RoomType; name: string; x: number; y: number; width: number; length: number; floor: number; doors: { wall: string }[] }[];
  plot: { width: number; length: number; roadSide: string };
  entryRoomId?: string;
}

// Adjacency helper: two rooms are adjacent if they share a wall segment
export function areAdjacent(
  a: { x: number; y: number; width: number; length: number },
  b: { x: number; y: number; width: number; length: number },
  tol = 0.6,
): boolean {
  // share a vertical wall (left/right)
  const vShare =
    (Math.abs(a.x + a.width - b.x) < tol || Math.abs(b.x + b.width - a.x) < tol) &&
    a.y < b.y + b.length - tol &&
    a.y + a.length > b.y + tol;
  // share a horizontal wall (top/bottom)
  const hShare =
    (Math.abs(a.y + a.length - b.y) < tol || Math.abs(b.y + b.length - a.y) < tol) &&
    a.x < b.x + b.width - tol &&
    a.x + a.width > b.x + tol;
  return vShare || hShare;
}

export const PROHIBITIONS: ProhibitionRule[] = [
  {
    id: 'garage-without-foyer',
    description: 'Parking/garage placed as the first room from entry without a mudroom/foyer buffer.',
    check: (ctx) => {
      const parking = ctx.rooms.find((r) => r.type === 'parking');
      const foyer = ctx.rooms.find((r) => r.type === 'foyer');
      const living = ctx.rooms.find((r) => r.type === 'living');
      if (!parking) return false;
      // In Indian homes, parking at the front is standard. The violation is only
      // if there's NO living room or foyer to buffer the entry into the house.
      // If a living room exists, the entry goes through living, not parking — OK.
      if (living || foyer) return false;
      // No living or foyer at all — parking is the only front room = violation
      return true;
    },
  },
  {
    id: 'kitchen-isolated',
    description: 'Kitchen isolated at the far end of the house away from dining/living.',
    check: (ctx) => {
      const kitchen = ctx.rooms.find((r) => r.type === 'kitchen');
      if (!kitchen) return false;
      const dining = ctx.rooms.find((r) => r.type === 'dining');
      const living = ctx.rooms.find((r) => r.type === 'living');
      const adjTo = ctx.rooms.filter((r) => r.type === 'dining' || r.type === 'living');
      if (adjTo.length === 0) return false; // no dining/living to check against
      const isAdjacent = adjTo.some((r) => areAdjacent(kitchen, r));
      return !isAdjacent;
    },
  },
  {
    id: 'bathroom-off-living',
    description: 'Bathroom opening directly off living room.',
    check: (ctx) => {
      const baths = ctx.rooms.filter((r) => r.type === 'bathroom');
      const living = ctx.rooms.find((r) => r.type === 'living');
      const dining = ctx.rooms.find((r) => r.type === 'dining');
      if (!living && !dining) return false;
      for (const b of baths) {
        if (living && areAdjacent(b, living)) return true;
        if (dining && areAdjacent(b, dining)) return true;
      }
      return false;
    },
  },
  {
    id: 'bedroom-as-passage',
    description: 'Bedroom used as passage to other rooms (a bedroom should not be the only path between two other rooms).',
    check: (ctx) => {
      // Simplified: a bedroom with doors on 3+ walls might be a passage
      const bedrooms = ctx.rooms.filter((r) => r.type === 'bedroom');
      for (const b of bedrooms) {
        if (b.doors.length >= 3) return true;
      }
      return false;
    },
  },
  {
    id: 'garage-adjacent-bedroom',
    description: 'Garage/parking directly adjacent to a bedroom (noise/fume separation required).',
    check: (ctx) => {
      const parking = ctx.rooms.find((r) => r.type === 'parking');
      if (!parking) return false;
      const bedrooms = ctx.rooms.filter((r) => r.type === 'bedroom' && r.floor === parking.floor);
      return bedrooms.some((b) => areAdjacent(parking, b));
    },
  },
];

// =========================================================================
// 7. KITCHEN WORK TRIANGLE
// Sink, cooktop, refrigerator form a triangle. Perimeter 3.6m–6.6m (12–22 ft).
// (Checked at the furniture level — the planner places these 3 items.)
// =========================================================================
export const WORK_TRIANGLE_MIN = 12; // ft (3.6 m)
export const WORK_TRIANGLE_MAX = 22; // ft (6.6 m)

// =========================================================================
// 8. CIRCULATION
// =========================================================================
export const MIN_HALLWAY_WIDTH = 3; // ft (~900 mm)
export const MAX_DEAD_END_CORRIDOR = 20; // ft (~6 m)

// =========================================================================
// HELPER: build the adjacency map for a set of rooms (which rooms are actually
// adjacent in a given layout). Returns a map roomId → list of adjacent roomIds.
// =========================================================================
export function buildAdjacencyMap(
  rooms: { id: string; x: number; y: number; width: number; length: number; floor: number }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const r of rooms) map[r.id] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      if (a.floor !== b.floor) continue;
      if (areAdjacent(a, b)) {
        map[a.id].push(b.id);
        map[b.id].push(a.id);
      }
    }
  }
  return map;
}

// Check if a room of type A is adjacent to at least one room of type B
export function isAdjacentToType(
  rooms: { id: string; type: RoomType; x: number; y: number; width: number; length: number; floor: number }[],
  roomId: string,
  targetType: RoomType,
): boolean {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return false;
  return rooms.some(
    (r) => r.id !== roomId && r.type === targetType && r.floor === room.floor && areAdjacent(room, r),
  );
}
