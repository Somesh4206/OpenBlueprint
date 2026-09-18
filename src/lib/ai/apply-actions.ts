import {
  AiAction,
  DesignInsight,
  LayoutData,
  LayoutStrategy,
  ProjectConfig,
  RoomRect,
  RoomType,
} from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { genId, generateLayout } from '../layout/engine';

const STRATEGY_MAP: Record<string, LayoutStrategy> = {
  open: 'modern-open',
  modern: 'modern-open',
  privacy: 'privacy-optimized',
  ventilat: 'ventilation-optimized',
  compact: 'space-optimized',
  space: 'space-optimized',
  vastu: 'vastu-optimized',
};

export function applyActions(
  layout: LayoutData,
  config: ProjectConfig,
  actions: AiAction[],
  floor = 0,
): LayoutData {
  let rooms = [...layout.rooms];
  let furniture = [...(layout.furniture || [])];

  for (const a of actions) {
    switch (a.type) {
      case 'resize-room': {
        const idx = rooms.findIndex(
          (r) => (a.roomName && r.name === a.roomName) || (a.roomType && r.type === a.roomType),
        );
        if (idx >= 0) {
          const r = rooms[idx];
          const cat = ROOM_CATALOG[r.type];
          const newW = Math.max(cat.minWidth, r.width + (a.deltaW || 0));
          const newL = Math.max(cat.minLength, r.length + (a.deltaL || 0));
          rooms[idx] = { ...r, width: Math.round(newW * 10) / 10, length: Math.round(newL * 10) / 10 };
        }
        break;
      }
      case 'move-room': {
        const idx = rooms.findIndex(
          (r) => (a.roomName && r.name === a.roomName) || (a.roomType && r.type === a.roomType),
        );
        if (idx >= 0) {
          rooms[idx] = relocateRoom(rooms[idx], layout.plot, a.targetLocation || 'center');
        }
        break;
      }
      case 'add-room': {
        const type = a.roomType || 'bedroom';
        // Staircases are furniture, not rooms — drop one into the best host
        // room on the current floor (selectable/resizable like all furniture).
        if (type === 'staircase' || type === ('spiral-staircase' as RoomType)) {
          const f = placeStaircaseFurniture(layout, floor);
          if (f) furniture.push(f);
          break;
        }
        const cat = ROOM_CATALOG[type];
        const newRoom = placeNewRoom(type, a.roomName || cat.defaultName, rooms, layout.plot, a.targetRoomType, floor);
        if (newRoom) rooms.push(newRoom);
        break;
      }
      case 'remove-room': {
        if (a.roomName) {
          rooms = rooms.filter((r) => r.name !== a.roomName);
        } else if (a.roomType) {
          // remove the last instance of that type
          const idx = rooms.map((r) => r.type).lastIndexOf(a.roomType);
          if (idx >= 0) rooms.splice(idx, 1);
        }
        break;
      }
      case 'rename-room': {
        if (a.roomName) {
          const newName = (a as AiAction & { newName?: string }).newName;
          rooms = rooms.map((r) => (r.name === a.roomName && newName ? { ...r, name: newName } : r));
        }
        break;
      }
      case 'rearrange': {
        const hint = (a.targetLocation || '').toLowerCase();
        const strat = Object.keys(STRATEGY_MAP).find((k) => hint.includes(k));
        const strategy = strat ? STRATEGY_MAP[strat] : 'space-optimized';
        return generateLayout(config, strategy);
      }
      case 'note':
      default:
        break;
    }
  }

  return { ...layout, rooms, furniture };
}

/** Drop a staircase furniture item into the largest free corner of the best
 * host room on `floor` (living → dining → foyer → largest non-parking). */
function placeStaircaseFurniture(layout: LayoutData, floor: number): import('../types').FurnitureItem | null {
  const hosts = layout.rooms
    .filter((r) => r.floor === floor && r.type !== 'parking')
    .sort((a, b) => {
      const rank = (t: RoomType) => ({ living: 0, dining: 1, foyer: 2 } as Record<string, number>)[t] ?? 9;
      return rank(a.type) - rank(b.type) || b.width * b.length - a.width * a.length;
    });
  for (const host of hosts) {
    const w = Math.min(7, host.width - 1);
    const l = Math.min(12, host.length - 1);
    if (w < 3 || l < 6) continue;
    const taken = (layout.furniture || []).filter((it) => it.floor === floor);
    const m = 0.5;
    const corners = [
      { x: host.x + m, y: host.y + m },
      { x: host.x + host.width - w - m, y: host.y + m },
      { x: host.x + m, y: host.y + host.length - l - m },
      { x: host.x + host.width - w - m, y: host.y + host.length - l - m },
    ];
    for (const c of corners) {
      if (c.x < host.x + m - 0.01 || c.y < host.y + m - 0.01) continue;
      if (c.x + w > host.x + host.width - m + 0.01 || c.y + l > host.y + host.length - m + 0.01) continue;
      const clash = taken.some(
        (it) => c.x < it.x + it.width + 0.25 && c.x + w + 0.25 > it.x && c.y < it.y + it.length + 0.25 && c.y + l + 0.25 > it.y,
      );
      if (clash) continue;
      return {
        id: genId('f'), type: 'staircase', name: 'staircase',
        x: Math.round(c.x * 10) / 10, y: round1(c.y),
        width: Math.round(w * 10) / 10, length: Math.round(l * 10) / 10,
        rotation: 0, floor,
      };
    }
  }
  return null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function relocateRoom(room: RoomRect, plot: { width: number; length: number }, loc: string): RoomRect {
  const w = room.width;
  const l = room.length;
  let x = room.x;
  let y = room.y;
  switch (loc) {
    case 'front':
      y = Math.max(0, plot.length - l - 1);
      x = Math.max(0, Math.min(plot.width - w, room.x));
      break;
    case 'rear':
      y = 1;
      x = Math.max(0, Math.min(plot.width - w, room.x));
      break;
    case 'side':
      x = Math.max(0, Math.min(plot.width - w, room.x === 0 ? 1 : plot.width - w - 1));
      break;
    case 'sw': // South-West (top-right in our coords where y-down = south)
      x = Math.max(0, plot.width - w - 1);
      y = Math.max(0, plot.length - l - 1);
      break;
    case 'se': // South-East (top-left)
      x = 1;
      y = Math.max(0, plot.length - l - 1);
      break;
    case 'ne': // North-East (bottom-left)
      x = 1;
      y = 1;
      break;
    case 'nw': // North-West (bottom-right)
      x = Math.max(0, plot.width - w - 1);
      y = 1;
      break;
    case 'center':
    default:
      x = Math.max(0, (plot.width - w) / 2);
      y = Math.max(0, (plot.length - l) / 2);
      break;
  }
  return { ...room, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function placeNewRoom(
  type: RoomType,
  name: string,
  existing: RoomRect[],
  plot: { width: number; length: number },
  attachTo?: RoomType,
  floor = 0,
): RoomRect | null {
  const cat = ROOM_CATALOG[type];
  const w = cat.preferredWidth;
  const l = cat.preferredLength;
  const sameFloor = existing.filter((r) => r.floor === floor);

  // try to place adjacent to attachTo room (same floor, non-overlapping)
  if (attachTo) {
    const target = sameFloor.find((r) => r.type === attachTo);
    if (target) {
      // try right of target
      const x = target.x + target.width + 0.2;
      const y = target.y;
      if (x + w <= plot.width - 0.5 && y + l <= plot.length - 0.5 && !hitsAny(x, y, w, l, sameFloor)) {
        return mkRoom(type, name, x, y, w, l, floor);
      }
      // try below target
      const y2 = target.y + target.length + 0.2;
      if (target.x + w <= plot.width - 0.5 && y2 + l <= plot.length - 0.5 && !hitsAny(target.x, y2, w, l, sameFloor)) {
        return mkRoom(type, name, target.x, y2, w, l, floor);
      }
    }
  }

  // scan for an empty spot on the SAME floor (never stack onto other floors)
  for (let y = 0.5; y + l <= plot.length - 0.5; y += 2) {
    for (let x = 0.5; x + w <= plot.width - 0.5; x += 2) {
      if (!hitsAny(x, y, w, l, sameFloor)) {
        return mkRoom(type, name, x, y, w, l, floor);
      }
    }
  }
  return null;
}

function hitsAny(x: number, y: number, w: number, h: number, rooms: RoomRect[]): boolean {
  return rooms.some(
    (r) =>
      r.x < x + w - 0.1 &&
      r.x + r.width > x + 0.1 &&
      r.y < y + h - 0.1 &&
      r.y + r.length > y + 0.1,
  );
}

function mkRoom(type: RoomType, name: string, x: number, y: number, w: number, l: number, floor = 0): RoomRect {
  return {
    id: genId(),
    type,
    name,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(w * 10) / 10,
    length: Math.round(l * 10) / 10,
    floor,
    doors: [{ wall: 'top', pos: 0.5, width: 3, swing: 'in-right' as const }],
    windows: [],
  };
}

export function regenerateStrategy(config: ProjectConfig, strategy: LayoutStrategy): LayoutData {
  return generateLayout(config, strategy);
}

export function generateInsights(layout: LayoutData, config: ProjectConfig): DesignInsight[] {
  const insights: DesignInsight[] = [];
  const builtUp = layout.rooms.reduce((s, r) => s + r.width * r.length, 0);
  const buildableW = layout.plot.width - layout.plot.setbackSides * 2;
  const buildableH = layout.plot.length - (layout.plot.setbackFront + layout.plot.setbackRear);
  const util = builtUp / (buildableW * buildableH * layout.floors || 1);

  if (util > 0.75) {
    insights.push({ kind: 'positive', title: 'Strong space utilization', detail: `Built-up area uses ${Math.round(util * 100)}% of the buildable plot — efficient use of space.` });
  } else if (util < 0.5) {
    insights.push({ kind: 'warning', title: 'Underutilized plot', detail: `Only ${Math.round(util * 100)}% of the buildable area is used. Consider larger rooms or an additional room.` });
  }

  // kitchen near dining
  const kitchen = layout.rooms.find((r) => r.type === 'kitchen');
  const dining = layout.rooms.find((r) => r.type === 'dining');
  if (kitchen && dining) {
    const adj = Math.abs(kitchen.x - dining.x) < (kitchen.width + dining.width) && Math.abs(kitchen.y - dining.y) < (kitchen.length + dining.length);
    const close = Math.hypot(kitchen.x + kitchen.width / 2 - (dining.x + dining.width / 2), kitchen.y + kitchen.length / 2 - (dining.y + dining.length / 2)) < 14;
    if (close) {
      insights.push({ kind: 'positive', title: 'Kitchen is conveniently connected', detail: 'Kitchen is adjacent to the dining area, supporting an efficient work triangle.' });
    }
  }

  // master bedroom + bathroom
  const master = layout.rooms.find((r) => r.type === 'bedroom' && r.name.toLowerCase().includes('master'));
  if (master) {
    const bath = layout.rooms.find((r) => r.type === 'bathroom');
    if (bath) {
      const close = Math.hypot(master.x + master.width / 2 - (bath.x + bath.width / 2), master.y + master.length / 2 - (bath.y + bath.length / 2)) < 12;
      if (close) insights.push({ kind: 'positive', title: 'Master bedroom has direct bathroom access', detail: 'Attached bathroom improves privacy and convenience.' });
    }
  }

  // ventilation
  const roomsNeedingLight = layout.rooms.filter((r) => r.type !== 'parking' && r.type !== 'store' && r.type !== 'utility');
  const noWindow = roomsNeedingLight.filter((r) => r.windows.length === 0);
  if (noWindow.length > 0) {
    const r = noWindow[0];
    insights.push({ kind: 'warning', title: `${r.name} has limited natural light`, detail: 'Consider adding a larger window on an outer wall, or relocating the room to the building perimeter.' });
    insights.push({ kind: 'suggestion', title: 'Add a window on the eastern wall', detail: 'East-facing windows bring morning light and help with natural ventilation.' });
  } else {
    insights.push({ kind: 'positive', title: 'Good natural lighting', detail: 'All habitable rooms have at least one window on an outer wall.' });
  }

  // parking
  const parking = layout.rooms.find((r) => r.type === 'parking');
  if (parking) {
    insights.push({ kind: 'positive', title: 'Parking near entrance', detail: 'Parking is placed at the road side for easy access.' });
  }

  // staircase (furniture, not a room)
  if (layout.floors > 1) {
    const stair = (layout.furniture || []).find((f) => f.type === 'staircase' || f.type === 'spiral-staircase');
    if (stair) insights.push({ kind: 'positive', title: 'Internal staircase', detail: 'Staircase is positioned for vertical circulation across floors.' });
  }

  return insights;
}
