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
};

export function applyActions(layout: LayoutData, config: ProjectConfig, actions: AiAction[]): LayoutData {
  let rooms = [...layout.rooms];

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
        const cat = ROOM_CATALOG[type];
        const newRoom = placeNewRoom(type, a.roomName || cat.defaultName, rooms, layout.plot, a.targetRoomType);
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

  return { ...layout, rooms };
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
): RoomRect | null {
  const cat = ROOM_CATALOG[type];
  const w = cat.preferredWidth;
  const l = cat.preferredLength;

  // try to place adjacent to attachTo room
  if (attachTo) {
    const target = existing.find((r) => r.type === attachTo);
    if (target) {
      // try right of target
      const x = target.x + target.width + 0.2;
      const y = target.y;
      if (x + w <= plot.width - 0.5 && y + l <= plot.length - 0.5) {
        return mkRoom(type, name, x, y, w, l);
      }
      // try below target
      const y2 = target.y + target.length + 0.2;
      if (target.x + w <= plot.width - 0.5 && y2 + l <= plot.length - 0.5) {
        return mkRoom(type, name, target.x, y2, w, l);
      }
    }
  }

  // scan for an empty spot
  for (let y = 0.5; y + l <= plot.length - 0.5; y += 2) {
    for (let x = 0.5; x + w <= plot.width - 0.5; x += 2) {
      const candidate = { x, y, w, h: l };
      const overlaps = existing.some((r) =>
        r.x < candidate.x + candidate.w - 0.1 &&
        r.x + r.width > candidate.x + 0.1 &&
        r.y < candidate.y + candidate.h - 0.1 &&
        r.y + r.length > candidate.y + 0.1,
      );
      if (!overlaps) {
        return mkRoom(type, name, x, y, w, l);
      }
    }
  }
  return null;
}

function mkRoom(type: RoomType, name: string, x: number, y: number, w: number, l: number): RoomRect {
  return {
    id: genId(),
    type,
    name,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    width: Math.round(w * 10) / 10,
    length: Math.round(l * 10) / 10,
    floor: 0,
    doors: [{ wall: 'top', pos: 0.5, width: 3 }],
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

  // staircase
  if (layout.floors > 1) {
    const stair = layout.rooms.find((r) => r.type === 'staircase');
    if (stair) insights.push({ kind: 'positive', title: 'Internal staircase', detail: 'Staircase is positioned for vertical circulation across floors.' });
  }

  return insights;
}
