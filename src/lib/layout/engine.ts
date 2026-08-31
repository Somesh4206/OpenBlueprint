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
export function expandRequirements(reqs: RoomRequirement[]): RoomRequirement[] {
  const out: RoomRequirement[] = [];
  for (const r of reqs) {
    for (let i = 0; i < (r.count || 1); i++) {
      out.push({
        ...r,
        name: r.count > 1 ? `${r.name} ${i + 1}` : r.name,
      });
    }
  }
  return out;
}

// ---- Buildable rectangle (plot minus setbacks) ----
export function buildableArea(plot: PlotConfig, floor: number): Rect {
  return {
    x: plot.setbackSides,
    y: plot.setbackRear,
    w: Math.max(0, plot.width - plot.setbackSides * 2),
    h: Math.max(0, plot.length - (plot.setbackFront + plot.setbackRear)),
  };
}

// ---- Slicing floor-plan generator (recursive binary partition) ----
interface PartitionNode {
  rect: Rect;
  children?: [PartitionNode, PartitionNode];
  room?: RoomRequirement;
}

function shuffleByStrategy(items: RoomRequirement[], strategy: LayoutStrategy): RoomRequirement[] {
  const arr = [...items];
  const priority = { high: 0, medium: 1, low: 2 } as const;
  arr.sort((a, b) => priority[a.priority] - priority[b.priority]);
  if (strategy === 'privacy-optimized') {
    arr.sort((a, b) => {
      const aPrivate = ROOM_CATALOG[a.type].group === 'private' ? 1 : 0;
      const bPrivate = ROOM_CATALOG[b.type].group === 'private' ? 1 : 0;
      return bPrivate - aPrivate;
    });
  }
  if (strategy === 'modern-open') {
    arr.sort((a, b) => {
      const aPub = ROOM_CATALOG[a.type].group === 'public' ? 0 : 1;
      const bPub = ROOM_CATALOG[b.type].group === 'public' ? 0 : 1;
      return aPub - bPub;
    });
  }
  if (strategy === 'vastu-optimized') {
    // Order rooms by Vastu-preferred placement so BSP puts them in the right quadrant.
    // SW (master bedroom, staircase) → SE (kitchen) → NE (pooja, living, entrance) → NW (parking, bathroom) → others
    const vastuOrder: Record<string, number> = {
      bedroom: 0, // SW (master first)
      staircase: 1, // S/W/SW
      kitchen: 2, // SE
      pooja: 3, // NE
      living: 4, // NE/N
      foyer: 5, // E/N
      dining: 6, // E
      parking: 7, // NW/SE
      bathroom: 8, // NW/W
      utility: 9, // NW
      store: 10, // S/W
      office: 11, // W/SW
      balcony: 12, // N/E/NE
    };
    arr.sort((a, b) => (vastuOrder[a.type] ?? 99) - (vastuOrder[b.type] ?? 99));
  }
  return arr;
}

function tryPlace(
  node: PartitionNode,
  rooms: RoomRequirement[],
  idx: number,
  strategy: LayoutStrategy,
): boolean {
  if (idx >= rooms.length) return true;
  const room = rooms[idx];
  const cat = ROOM_CATALOG[room.type];
  const minW = Math.min(room.minWidth, cat.minWidth);
  const minL = Math.min(room.minLength, cat.minLength);
  const prefW = Math.max(room.preferredWidth, cat.preferredWidth);
  const prefL = Math.max(room.preferredLength, cat.preferredLength);

  const r = node.rect;
  const fitsPreferred = r.w >= prefW && r.h >= prefL;
  const fitsMin = r.w >= minW && r.h >= minL;
  if (!fitsMin) return false;

  const roomW = fitsPreferred ? Math.min(prefW, r.w) : minW;
  const roomH = fitsPreferred ? Math.min(prefL, r.h) : minL;
  const leftoverW = r.w - roomW;
  const leftoverH = r.h - roomH;

  let splitDir: 'h' | 'v' | null = null;
  const remaining = rooms.length - idx - 1;
  if (remaining > 0) {
    if (strategy === 'ventilation-optimized') {
      splitDir = leftoverH >= minL * 0.8 && leftoverH >= leftoverW ? 'h' : 'v';
    } else if (strategy === 'space-optimized') {
      splitDir = leftoverW >= minW * 0.8 && leftoverW >= leftoverH ? 'v' : 'h';
    } else {
      splitDir = leftoverH >= leftoverW ? 'h' : 'v';
    }
  }

  if (splitDir === 'h' && leftoverH >= minL) {
    node.children = [
      { rect: { x: r.x, y: r.y, w: r.w, h: roomH } },
      { rect: { x: r.x, y: r.y + roomH, w: r.w, h: leftoverH } },
    ];
    node.children[0].room = room;
    return tryPlace(node.children[1], rooms, idx + 1, strategy);
  } else if (splitDir === 'v' && leftoverW >= minW) {
    node.children = [
      { rect: { x: r.x, y: r.y, w: roomW, h: r.h } },
      { rect: { x: r.x + roomW, y: r.y, w: leftoverW, h: r.h } },
    ];
    node.children[0].room = room;
    return tryPlace(node.children[1], rooms, idx + 1, strategy);
  } else {
    node.room = room;
    return true;
  }
}

function collectRooms(
  node: PartitionNode,
  out: RoomRect[],
  floor: number,
  plot: PlotConfig,
  roadSide: PlotConfig['roadSide'],
) {
  if (node.room) {
    const cat = ROOM_CATALOG[node.room.type];
    const rect = node.rect;
    const roomRect: RoomRect = {
      id: genId(),
      type: node.room.type,
      name: node.room.name || cat.defaultName,
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.w),
      length: round(rect.h),
      floor,
      doors: [],
      windows: [],
    };
    roomRect.doors = autoDoors(roomRect, plot, roadSide);
    roomRect.windows = autoWindows(roomRect, plot);
    out.push(roomRect);
  }
  if (node.children) {
    for (const c of node.children) collectRooms(c, out, floor, plot, roadSide);
  }
}

function autoDoors(room: RoomRect, plot: PlotConfig, roadSide: PlotConfig['roadSide']): DoorMarker[] {
  const doors: DoorMarker[] = [];
  const isPublic = ROOM_CATALOG[room.type].group === 'public';
  const onBoundary =
    room.x <= 0.1 ||
    room.y <= 0.1 ||
    room.x + room.width >= plot.width - 0.1 ||
    room.y + room.length >= plot.length - 0.1;

  if (isPublic && onBoundary) {
    const wall = roadWall(room, plot, roadSide);
    if (wall) doors.push({ wall, pos: 0.5, width: 3.5 });
  } else {
    const wall = centerWall(room, plot);
    if (wall) doors.push({ wall, pos: 0.5, width: 3 });
  }
  if (ROOM_CATALOG[room.type].group === 'private' || ROOM_CATALOG[room.type].group === 'service') {
    const wall = centerWall(room, plot);
    if (wall && !doors.some((d) => d.wall === wall)) {
      doors.push({ wall, pos: 0.5, width: 2.8 });
    }
  }
  return doors;
}

function roadWall(room: RoomRect, plot: PlotConfig, roadSide: PlotConfig['roadSide']): DoorMarker['wall'] | null {
  switch (roadSide) {
    case 'south':
      if (Math.abs(room.y + room.length - plot.length) < 0.1) return 'bottom';
      break;
    case 'north':
      if (Math.abs(room.y) < 0.1) return 'top';
      break;
    case 'east':
      if (Math.abs(room.x + room.width - plot.width) < 0.1) return 'right';
      break;
    case 'west':
      if (Math.abs(room.x) < 0.1) return 'left';
      break;
  }
  if (Math.abs(room.y + room.length - plot.length) < 0.1) return 'bottom';
  if (Math.abs(room.y) < 0.1) return 'top';
  if (Math.abs(room.x + room.width - plot.width) < 0.1) return 'right';
  if (Math.abs(room.x) < 0.1) return 'left';
  return null;
}

function centerWall(room: RoomRect, plot: PlotConfig): DoorMarker['wall'] | null {
  const cx = plot.width / 2;
  const cy = plot.length / 2;
  const rcx = room.x + room.width / 2;
  const rcy = room.y + room.length / 2;
  const dx = cx - rcx;
  const dy = cy - rcy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'bottom' : 'top';
  }
}

function autoWindows(room: RoomRect, plot: PlotConfig): WindowMarker[] {
  const wins: WindowMarker[] = [];
  const outerWalls: DoorMarker['wall'][] = [];
  if (Math.abs(room.y) < 0.1) outerWalls.push('top');
  if (Math.abs(room.y + room.length - plot.length) < 0.1) outerWalls.push('bottom');
  if (Math.abs(room.x) < 0.1) outerWalls.push('left');
  if (Math.abs(room.x + room.width - plot.width) < 0.1) outerWalls.push('right');
  if (room.type === 'parking' || room.type === 'store' || room.type === 'utility') return wins;
  for (const w of outerWalls.slice(0, 2)) {
    wins.push({ wall: w, pos: 0.3, width: 4 });
  }
  return wins;
}

const STRATEGIES: { strategy: LayoutStrategy; name: string; tagline: string }[] = [
  { strategy: 'space-optimized', name: 'Design A', tagline: 'Space Optimized' },
  { strategy: 'ventilation-optimized', name: 'Design B', tagline: 'Ventilation Optimized' },
  { strategy: 'modern-open', name: 'Design C', tagline: 'Modern Open Layout' },
  { strategy: 'privacy-optimized', name: 'Design D', tagline: 'Privacy Optimized' },
  { strategy: 'vastu-optimized', name: 'Design E', tagline: 'Vastu Compliant' },
];

function ensureStaircase(reqs: RoomRequirement[], floors: number): RoomRequirement[] {
  const hasStair = reqs.some((r) => r.type === 'staircase');
  if (floors > 1 && !hasStair) {
    return [
      ...reqs,
      {
        type: 'staircase',
        name: 'Staircase',
        count: 1,
        minWidth: 6,
        minLength: 10,
        preferredWidth: 7,
        preferredLength: 12,
        priority: 'high',
        preferredLocation: 'center',
      },
    ];
  }
  return reqs;
}

function placeParkingStrip(
  buildable: Rect,
  roadSide: PlotConfig['roadSide'],
): { parking: Rect | null; rest: Rect } {
  const parkingDepth = 20;
  let parking: Rect | null = null;
  let rest = { ...buildable };
  if (buildable.h > parkingDepth + 10 && (roadSide === 'south' || roadSide === 'north')) {
    if (roadSide === 'south') {
      parking = { x: buildable.x, y: buildable.y + buildable.h - parkingDepth, w: buildable.w, h: parkingDepth };
      rest = { x: buildable.x, y: buildable.y, w: buildable.w, h: buildable.h - parkingDepth };
    } else {
      parking = { x: buildable.x, y: buildable.y, w: buildable.w, h: parkingDepth };
      rest = { x: buildable.x, y: buildable.y + parkingDepth, w: buildable.w, h: buildable.h - parkingDepth };
    }
  } else if (buildable.w > 18 && (roadSide === 'east' || roadSide === 'west')) {
    if (roadSide === 'east') {
      parking = { x: buildable.x + buildable.w - 18, y: buildable.y, w: 18, h: buildable.h };
      rest = { x: buildable.x, y: buildable.y, w: buildable.w - 18, h: buildable.h };
    } else {
      parking = { x: buildable.x, y: buildable.y, w: 18, h: buildable.h };
      rest = { x: buildable.x + 18, y: buildable.y, w: buildable.w - 18, h: buildable.h };
    }
  }
  return { parking, rest };
}

export function generateFloorLayout(
  config: ProjectConfig,
  strategy: LayoutStrategy,
  floor: number,
  floorReqs: RoomRequirement[] = expandRequirements(config.rooms),
): RoomRect[] {
  const buildable = buildableArea(config.plot, floor);
  let reqs = [...floorReqs];
  if (config.floors > 1) {
    reqs = ensureStaircase(reqs, config.floors);
  }

  const out: RoomRect[] = [];

  const wantsParking = reqs.some((r) => r.type === 'parking');
  let partitionRect = buildable;
  if (floor === 0 && wantsParking) {
    const { parking, rest } = placeParkingStrip(buildable, config.plot.roadSide);
    if (parking) {
      const parkingReq = reqs.find((r) => r.type === 'parking')!;
      const pr: RoomRect = {
        id: genId(),
        type: 'parking',
        name: parkingReq.name,
        x: round(parking.x),
        y: round(parking.y),
        width: round(parking.w),
        length: round(parking.h),
        floor,
        doors: [{ wall: roadWallSide(parking, config.plot), pos: 0.5, width: 10 }],
        windows: [],
      };
      out.push(pr);
      partitionRect = rest;
      reqs = reqs.filter((r) => r.type !== 'parking');
    }
  }

  const sorted = shuffleByStrategy(reqs, strategy);

  // ---- BSP (Binary Space Partition) packing — zero wasted space ----
  // Recursively split the partition rectangle so every room fills its allocated
  // leaf exactly. Rooms tile the buildable area with no gaps between them.
  const placed = bspPack(partitionRect, sorted, strategy);

  for (const p of placed) {
    const roomRect: RoomRect = {
      id: genId(),
      type: p.req.type,
      name: p.req.name || ROOM_CATALOG[p.req.type].defaultName,
      x: round(p.rect.x),
      y: round(p.rect.y),
      width: round(p.rect.w),
      length: round(p.rect.h),
      floor,
      doors: [],
      windows: [],
    };
    roomRect.doors = autoDoors(roomRect, config.plot, config.plot.roadSide);
    roomRect.windows = autoWindows(roomRect, config.plot);
    out.push(roomRect);
  }

  return out;
}

// ---- BSP packing implementation ----
interface BspLeaf {
  rect: Rect;
  room?: RoomRequirement;
  left?: BspLeaf;
  right?: BspLeaf;
}

interface PlacedRoom {
  rect: Rect;
  req: RoomRequirement;
}

// Recursively split the rect to place all rooms; each leaf = one room filling it.
function bspPack(rect: Rect, rooms: RoomRequirement[], strategy: LayoutStrategy): PlacedRoom[] {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) {
    return [{ rect, req: rooms[0] }];
  }

  // Decide split: split the longer dimension, proportional to room areas.
  // Compute total preferred area and split ratio based on first half's preferred area.
  const totalArea = rect.w * rect.h;
  let acc = 0;
  const targetAreas = rooms.map((r) => {
    const cat = ROOM_CATALOG[r.type];
    return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
  });
  const totalPreferred = targetAreas.reduce((a, b) => a + b, 0);

  // Find split index that best balances area (closest to half)
  let splitIdx = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < rooms.length; i++) {
    acc = targetAreas.slice(0, i).reduce((a, b) => a + b, 0);
    const ratio = acc / totalPreferred;
    const diff = Math.abs(ratio - 0.5);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIdx = i;
    }
  }
  const leftRooms = rooms.slice(0, splitIdx);
  const rightRooms = rooms.slice(splitIdx);
  const leftArea = targetAreas.slice(0, splitIdx).reduce((a, b) => a + b, 0);
  const splitRatio = totalPreferred > 0 ? leftArea / totalPreferred : 0.5;

  // Split direction: split along the longer dimension for better aspect ratios
  const splitVertical = rect.w >= rect.h;
  let leftRect: Rect;
  let rightRect: Rect;

  if (splitVertical) {
    // vertical split — divide width
    let splitW = rect.w * splitRatio;
    // clamp so both sides can hold a minimum room, then snap to 0.5ft grid
    const minSide = 6;
    splitW = Math.max(minSide, Math.min(rect.w - minSide, splitW));
    splitW = Math.round(splitW * 2) / 2; // snap to 0.5ft
    leftRect = { x: rect.x, y: rect.y, w: splitW, h: rect.h };
    rightRect = { x: rect.x + splitW, y: rect.y, w: rect.w - splitW, h: rect.h };
  } else {
    // horizontal split — divide height
    let splitH = rect.h * splitRatio;
    const minSide = 6;
    splitH = Math.max(minSide, Math.min(rect.h - minSide, splitH));
    splitH = Math.round(splitH * 2) / 2; // snap to 0.5ft
    leftRect = { x: rect.x, y: rect.y, w: rect.w, h: splitH };
    rightRect = { x: rect.x, y: rect.y + splitH, w: rect.w, h: rect.h - splitH };
  }

  // Strategy can swap which group goes to which side
  let firstRooms = leftRooms;
  let secondRooms = rightRooms;
  if (strategy === 'privacy-optimized') {
    // private rooms to the rear (bottom), public to front (top)
    const privFirst = leftRooms.filter((r) => ROOM_CATALOG[r.type].group === 'private').length;
    const privSecond = rightRooms.filter((r) => ROOM_CATALOG[r.type].group === 'private').length;
    if (privSecond > privFirst) {
      firstRooms = rightRooms;
      secondRooms = leftRooms;
    }
  }
  if (strategy === 'vastu-optimized') {
    // For Vastu: SW (master bedroom) goes to top-right; NE (pooja, living) to bottom-left.
    // In our coords (origin top-left, y-down): top = high-y (south), right = high-x (east).
    // So SW = top-right, SE = top-left, NE = bottom-left, NW = bottom-right.
    // Count "SW-preferring" rooms (bedroom, staircase, office) in each group.
    const swTypes = new Set(['bedroom', 'staircase', 'office', 'store']);
    const swInFirst = leftRooms.filter((r) => swTypes.has(r.type)).length;
    const swInSecond = rightRooms.filter((r) => swTypes.has(r.type)).length;
    // firstRooms go to the LEFT rect. For vertical split, left=west. For horizontal, left=top.
    // We want SW-preferring rooms on the top (south) side.
    if (splitVertical) {
      // vertical split: leftRect=west, rightRect=east. SW needs east → put sw-preferring rooms in right (second).
      if (swInFirst > swInSecond) {
        firstRooms = rightRooms;
        secondRooms = leftRooms;
      }
    } else {
      // horizontal split: leftRect=top(south), rightRect=bottom(north). SW needs top → put sw-preferring in first.
      if (swInSecond > swInFirst) {
        firstRooms = rightRooms;
        secondRooms = leftRooms;
      }
    }
  }

  return [...bspPack(leftRect, firstRooms, strategy), ...bspPack(rightRect, secondRooms, strategy)];
}

// Distribute room requirements across floors.
// Ground floor: parking, living, kitchen, staircase (+ dining only if no parking), 1 bathroom.
// Upper floors: bedrooms, bathrooms, dining (if parking present), balcony, pooja, office, utility.
function distributeRoomsByFloor(reqs: RoomRequirement[], floors: number): RoomRequirement[][] {
  const expanded = expandRequirements(reqs);
  const byFloor: RoomRequirement[][] = Array.from({ length: floors }, () => []);
  const hasParking = expanded.some((r) => r.type === 'parking');
  // ground floor core types (dining goes upstairs when parking present to save space)
  const groundTypes = hasParking && floors > 1
    ? new Set(['parking', 'living', 'kitchen', 'foyer', 'store', 'staircase'])
    : new Set(['parking', 'living', 'dining', 'kitchen', 'foyer', 'store', 'staircase']);

  const bathrooms = expanded.filter((r) => r.type === 'bathroom');
  const upstairs = expanded.filter(
    (r) => !groundTypes.has(r.type) && r.type !== 'bathroom',
  );

  // ground floor gets public + parking (+ 1 bathroom only if single floor or no parking)
  for (const r of expanded) {
    if (groundTypes.has(r.type)) byFloor[0].push(r);
  }
  let bathroomIdx = 0;
  if (bathrooms.length > 0 && floors === 1) {
    byFloor[0].push(...bathrooms);
    bathroomIdx = bathrooms.length;
  } else if (bathrooms.length > 0 && !hasParking) {
    // multi-floor without parking: one bathroom on ground
    byFloor[0].push(bathrooms[0]);
    bathroomIdx = 1;
  }
  // when parking + multi-floor, all bathrooms go upstairs (attached to bedrooms)

  // distribute upstairs rooms across upper floors
  const remainingBaths = bathrooms.slice(bathroomIdx);
  const upstairsAll = [...upstairs, ...remainingBaths];
  if (floors > 1) {
    const perFloor = Math.ceil(upstairsAll.length / (floors - 1));
    for (let f = 1; f < floors; f++) {
      byFloor[f] = upstairsAll.slice((f - 1) * perFloor, f * perFloor);
    }
  } else {
    byFloor[0].push(...upstairsAll);
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

export function generateLayout(config: ProjectConfig, strategy: LayoutStrategy): LayoutData {
  const rooms: RoomRect[] = [];
  const byFloor = distributeRoomsByFloor(config.rooms, config.floors);
  for (let f = 0; f < config.floors; f++) {
    const floorRooms = generateFloorLayout(config, strategy, f, byFloor[f] || []);
    rooms.push(...floorRooms);
  }
  // auto-place starter furniture in each room based on room type
  const furniture = autoPlaceFurniture(rooms);
  return {
    plot: config.plot,
    floors: config.floors,
    rooms,
    furniture,
    strategy,
  };
}

// Auto-place sensible starter furniture in each room (bed in bedroom, sofa in living, etc.)
function autoPlaceFurniture(rooms: RoomRect[]): import('../types').FurnitureItem[] {
  const items: import('../types').FurnitureItem[] = [];
  for (const room of rooms) {
    const center = { x: room.x + room.width / 2, y: room.y + room.length / 2 };
    const inset = 1;
    switch (room.type) {
      case 'bedroom': {
        const bedW = Math.min(6, room.width - 2);
        const bedL = Math.min(7, room.length - 2);
        items.push(mkFurniture('bed-double', room.x + inset, room.y + inset, bedW, bedL, room.floor, 0));
        if (room.width > 10) {
          items.push(mkFurniture('wardrobe', room.x + room.width - 6, room.y + room.length - 2.5, 6, 2, room.floor, 0));
        }
        break;
      }
      case 'living': {
        const sofaW = Math.min(7, room.width - 2);
        items.push(mkFurniture('sofa-3', room.x + (room.width - sofaW) / 2, room.y + inset, sofaW, 3, room.floor, 0));
        items.push(mkFurniture('table-coffee', center.x - 2, center.y - 1, 4, 2, room.floor, 0));
        if (room.width > 10) {
          items.push(mkFurniture('tv-unit', room.x + (room.width - 5) / 2, room.y + room.length - 2, 5, 1.5, room.floor, 0));
        }
        items.push(mkFurniture('plant-small', room.x + room.width - 2, room.y + 0.5, 1.5, 1.5, room.floor, 0));
        break;
      }
      case 'kitchen': {
        items.push(mkFurniture('kitchen-counter', room.x + inset, room.y + inset, Math.min(8, room.width - 2), 2, room.floor, 0));
        items.push(mkFurniture('stove', room.x + inset, room.y + inset, 3, 2, room.floor, 0));
        items.push(mkFurniture('sink-kitchen', room.x + 4, room.y + inset, 2.5, 1.5, room.floor, 0));
        if (room.width > 9) {
          items.push(mkFurniture('fridge', room.x + room.width - 3.5, room.y + inset, 3, 2.5, room.floor, 0));
        }
        break;
      }
      case 'dining': {
        items.push(mkFurniture('table-dining-6', center.x - 2.5, center.y - 1.5, 5, 3, room.floor, 0));
        // 4 chairs around
        items.push(mkFurniture('chair-dining', center.x - 2.5, center.y - 0.5, 1.5, 1.5, room.floor, 0));
        items.push(mkFurniture('chair-dining', center.x + 1, center.y - 0.5, 1.5, 1.5, room.floor, 0));
        items.push(mkFurniture('chair-dining', center.x - 2.5, center.y + 1.5, 1.5, 1.5, room.floor, 180));
        items.push(mkFurniture('chair-dining', center.x + 1, center.y + 1.5, 1.5, 1.5, room.floor, 180));
        break;
      }
      case 'bathroom': {
        items.push(mkFurniture('toilet', room.x + inset, room.y + inset, 2, 3, room.floor, 0));
        items.push(mkFurniture('vanity', room.x + room.width - 3.5, room.y + inset, 3, 1.5, room.floor, 0));
        if (room.length > 7) {
          items.push(mkFurniture('shower', room.x + inset, room.y + room.length - 3.5, 3, 3, room.floor, 0));
        }
        break;
      }
      case 'office': {
        items.push(mkFurniture('desk', center.x - 2.5, room.y + inset, 5, 2.5, room.floor, 0));
        items.push(mkFurniture('chair-office', center.x - 1, room.y + 3.5, 2, 2, room.floor, 0));
        if (room.width > 8) {
          items.push(mkFurniture('bookshelf', room.x + room.width - 4.5, room.y + inset, 4, 1, room.floor, 0));
        }
        break;
      }
      case 'pooja': {
        items.push(mkFurniture('pooja-altar', center.x - 1.5, room.y + inset, 3, 1.5, room.floor, 0));
        break;
      }
      case 'parking': {
        // Add a car + a bike to parking rooms (Indian standard: 1 car + 1 bike per dwelling)
        const carW = Math.min(6, room.width - 2);
        const carL = Math.min(10, room.length - 2);
        items.push(mkFurniture('car', room.x + 1, room.y + (room.length - carL) / 2, carW, carL, room.floor, 0));
        // bike in the remaining space
        const bikeW = 2.5;
        const bikeL = 6;
        const bikeX = room.x + 1 + carW + 1;
        if (bikeX + bikeW < room.x + room.width - 0.5) {
          items.push(mkFurniture('bike', bikeX, room.y + (room.length - bikeL) / 2, bikeW, bikeL, room.floor, 0));
        }
        break;
      }
      case 'staircase': {
        // no furniture (stairs rendered as room texture)
        break;
      }
      case 'balcony': {
        items.push(mkFurniture('plant-small', room.x + inset, room.y + inset, 1.5, 1.5, room.floor, 0));
        items.push(mkFurniture('plant-small', room.x + room.width - 2, room.y + inset, 1.5, 1.5, room.floor, 0));
        break;
      }
      case 'utility': {
        items.push(mkFurniture('washer', room.x + inset, room.y + inset, 2.5, 2.5, room.floor, 0));
        break;
      }
    }
  }
  return items;
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

export function generateDesignOptions(config: ProjectConfig): ScoredLayout[] {
  const designs: ScoredLayout[] = [];
  for (const s of STRATEGIES) {
    const layout = generateLayout(config, s.strategy);
    const score = scoreLayout(layout, config);
    const builtUp = layout.rooms.reduce((sum, r) => sum + r.width * r.length, 0);
    designs.push({
      id: genId('d'),
      name: s.name,
      strategy: s.strategy,
      tagline: s.tagline,
      layout,
      score,
      builtUpArea: Math.round(builtUp),
      roomCount: layout.rooms.length,
    });
  }
  return designs;
}
