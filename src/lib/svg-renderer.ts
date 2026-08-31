import { LayoutData, RoomRect } from './types';
import { ROOM_CATALOG } from './room-catalog';

export interface RenderOptions {
  padding?: number;
  showGrid?: boolean;
  showDimensions?: boolean;
  showLabels?: boolean;
  showDoors?: boolean;
  showWindows?: boolean;
  showNorth?: boolean;
  floor?: number | 'all';
  scale?: number; // px per unit
  accentColor?: string;
  selectedRoomId?: string | null;
  blueprintMode?: boolean; // navy background
  compact?: boolean; // for thumbnails (no doors/dims)
}

export function renderBlueprintSVG(layout: LayoutData, opts: RenderOptions = {}): string {
  const padding = opts.padding ?? 40;
  const scale = opts.scale ?? 14;
  const { plot } = layout;
  const W = plot.width * scale + padding * 2;
  const H = plot.length * scale + padding * 2;

  const showGrid = opts.showGrid ?? true;
  const showDims = opts.showDimensions ?? true;
  const showLabels = opts.showLabels ?? true;
  const showDoors = opts.showDoors ?? true;
  const showWindows = opts.showWindows ?? true;
  const showNorth = opts.showNorth ?? true;
  const blueprintMode = opts.blueprintMode ?? false;
  const compact = opts.compact ?? false;

  const bg = blueprintMode ? '#0f2742' : '#fbfbf9';
  const gridColor = blueprintMode ? '#1d3a5c' : '#eceef2';
  const plotStroke = blueprintMode ? '#5b8bd0' : '#1e3a5f';
  const roomStroke = blueprintMode ? '#7fb0e8' : '#2b4a7a';
  const textColor = blueprintMode ? '#dce8f7' : '#1f2a3a';
  const subTextColor = blueprintMode ? '#9bb6d6' : '#5b6678';
  const accent = opts.accentColor || '#2b6fe0';

  const rooms = layout.rooms.filter(
    (r) => opts.floor === undefined || opts.floor === 'all' || r.floor === opts.floor,
  );

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`);
  parts.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  // grid
  if (showGrid) {
    for (let x = 0; x <= plot.width; x += 2) {
      const xp = padding + x * scale;
      parts.push(`<line x1="${xp}" y1="${padding}" x2="${xp}" y2="${padding + plot.length * scale}" stroke="${gridColor}" stroke-width="0.5"/>`);
    }
    for (let y = 0; y <= plot.length; y += 2) {
      const yp = padding + y * scale;
      parts.push(`<line x1="${padding}" y1="${yp}" x2="${padding + plot.width * scale}" y2="${yp}" stroke="${gridColor}" stroke-width="0.5"/>`);
    }
  }

  // plot boundary
  parts.push(
    `<rect x="${padding}" y="${padding}" width="${plot.width * scale}" height="${plot.length * scale}" fill="none" stroke="${plotStroke}" stroke-width="2.5"/>`,
  );

  // road indicator
  const roadW = 6;
  switch (plot.roadSide) {
    case 'south':
      parts.push(`<rect x="${padding}" y="${padding + plot.length * scale}" width="${plot.width * scale}" height="${roadW}" fill="${accent}" opacity="0.25"/>`);
      break;
    case 'north':
      parts.push(`<rect x="${padding}" y="${padding - roadW}" width="${plot.width * scale}" height="${roadW}" fill="${accent}" opacity="0.25"/>`);
      break;
    case 'east':
      parts.push(`<rect x="${padding + plot.width * scale}" y="${padding}" width="${roadW}" height="${plot.length * scale}" fill="${accent}" opacity="0.25"/>`);
      break;
    case 'west':
      parts.push(`<rect x="${padding - roadW}" y="${padding}" width="${roadW}" height="${plot.length * scale}" fill="${accent}" opacity="0.25"/>`);
      break;
  }

  // rooms
  for (const room of rooms) {
    const cat = ROOM_CATALOG[room.type];
    const rx = padding + room.x * scale;
    const ry = padding + room.y * scale;
    const rw = room.width * scale;
    const rl = room.length * scale;
    const fill = blueprintMode ? hexToRgba(cat.accent, 0.18) : cat.color;
    const stroke = opts.selectedRoomId === room.id ? accent : roomStroke;
    const sw = opts.selectedRoomId === room.id ? 2.5 : 1.5;
    parts.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rl}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);

    if (showLabels && rw > 40 && rl > 30) {
      const cx = rx + rw / 2;
      const cy = ry + rl / 2;
      const nameSize = compact ? 9 : 11;
      const dimSize = compact ? 7 : 9;
      parts.push(
        `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="${nameSize}" font-weight="600" fill="${textColor}">${escapeXml(room.name)}</text>`,
      );
      if (showDims) {
        parts.push(
          `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="${dimSize}" fill="${subTextColor}" font-family="ui-monospace, monospace">${formatDim(room.width, room.length, plot.unit)}</text>`,
        );
      }
    }

    // doors
    if (showDoors && !compact) {
      for (const d of room.doors) {
        parts.push(...renderDoor(room, d, rx, ry, rw, rl, padding, scale, accent, bg));
      }
    }
    // windows
    if (showWindows && !compact) {
      for (const w of room.windows) {
        parts.push(...renderWindow(room, w, rx, ry, rw, rl, padding, scale, plotStroke));
      }
    }
  }

  // north arrow
  if (showNorth && !compact) {
    const nx = padding + plot.width * scale - 30;
    const ny = padding + 18;
    parts.push(`<circle cx="${nx}" cy="${ny}" r="14" fill="none" stroke="${textColor}" stroke-width="1"/>`);
    parts.push(`<path d="M ${nx} ${ny - 10} L ${nx - 5} ${ny + 6} L ${nx} ${ny + 2} L ${nx + 5} ${ny + 6} Z" fill="${accent}" stroke="${accent}"/>`);
    parts.push(`<text x="${nx}" y="${ny + 22}" text-anchor="middle" font-size="9" font-weight="700" fill="${textColor}">N</text>`);
  }

  // scale bar
  if (!compact) {
    const sbx = padding;
    const sby = H - padding / 2;
    const sbLen = 10 * scale;
    parts.push(`<line x1="${sbx}" y1="${sby}" x2="${sbx + sbLen}" y2="${sby}" stroke="${textColor}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${sbx}" y1="${sby - 4}" x2="${sbx}" y2="${sby + 4}" stroke="${textColor}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${sbx + sbLen}" y1="${sby - 4}" x2="${sbx + sbLen}" y2="${sby + 4}" stroke="${textColor}" stroke-width="1.5"/>`);
    parts.push(`<text x="${sbx + sbLen / 2}" y="${sby - 7}" text-anchor="middle" font-size="9" fill="${subTextColor}" font-family="ui-monospace, monospace">10 ${plot.unit}</text>`);
  }

  parts.push('</svg>');
  return parts.join('');
}

function renderDoor(
  room: RoomRect,
  d: { wall: string; pos: number; width: number },
  rx: number,
  ry: number,
  rw: number,
  rl: number,
  _padding: number,
  scale: number,
  accent: string,
  bgColor: string,
): string[] {
  const dw = d.width * scale;
  let x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0;
  let ax1 = 0,
    ay1 = 0,
    ax2 = 0,
    ay2 = 0;
  switch (d.wall) {
    case 'top':
      x1 = rx + rw * d.pos - dw / 2;
      y1 = ry;
      x2 = x1 + dw;
      y2 = ry;
      ax1 = x1;
      ay1 = ry;
      ax2 = x1;
      ay2 = ry + dw;
      break;
    case 'bottom':
      x1 = rx + rw * d.pos - dw / 2;
      y1 = ry + rl;
      x2 = x1 + dw;
      y2 = ry + rl;
      ax1 = x1;
      ay1 = ry + rl;
      ax2 = x1;
      ay2 = ry + rl - dw;
      break;
    case 'left':
      x1 = rx;
      y1 = ry + rl * d.pos - dw / 2;
      x2 = rx;
      y2 = y1 + dw;
      ax1 = rx;
      ay1 = y1;
      ax2 = rx + dw;
      ay2 = y1;
      break;
    case 'right':
      x1 = rx + rw;
      y1 = ry + rl * d.pos - dw / 2;
      x2 = rx + rw;
      y2 = y1 + dw;
      ax1 = rx + rw;
      ay1 = y1;
      ax2 = rx + rw - dw;
      ay2 = y1;
      break;
  }
  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${bgColor}" stroke-width="3"/>`,
    `<path d="M ${ax1} ${ay1} A ${dw} ${dw} 0 0 1 ${ax2} ${ay2}" fill="none" stroke="${accent}" stroke-width="1" opacity="0.7"/>`,
  ];
}

function renderWindow(
  _room: RoomRect,
  w: { wall: string; pos: number; width: number },
  rx: number,
  ry: number,
  rw: number,
  rl: number,
  _padding: number,
  scale: number,
  stroke: string,
): string[] {
  const ww = w.width * scale;
  let x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0;
  switch (w.wall) {
    case 'top':
      x1 = rx + rw * w.pos - ww / 2;
      y1 = ry;
      x2 = x1 + ww;
      y2 = ry;
      break;
    case 'bottom':
      x1 = rx + rw * w.pos - ww / 2;
      y1 = ry + rl;
      x2 = x1 + ww;
      y2 = ry + rl;
      break;
    case 'left':
      x1 = rx;
      y1 = ry + rl * w.pos - ww / 2;
      x2 = rx;
      y2 = y1 + ww;
      break;
    case 'right':
      x1 = rx + rw;
      y1 = ry + rl * w.pos - ww / 2;
      x2 = rx + rw;
      y2 = y1 + ww;
      break;
  }
  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>`,
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${'#9ec5ff'}" stroke-width="1.5" stroke-dasharray="3,2"/>`,
  ];
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

function formatDim(w: number, l: number, unit: string): string {
  return `${formatMeasure(w)} × ${formatMeasure(l)}`;
}

function formatMeasure(n: number): string {
  const ft = Math.floor(n);
  const inch = Math.round((n - ft) * 12);
  if (inch === 0) return `${ft}'`;
  return `${ft}' ${inch}"`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function renderThumbnailSVG(layout: LayoutData, size = 200): string {
  const scale = Math.min(size / layout.plot.width, size / layout.plot.length) * 0.85;
  return renderBlueprintSVG(layout, {
    padding: 12,
    scale,
    showGrid: false,
    showDimensions: false,
    showLabels: true,
    showDoors: false,
    showWindows: false,
    showNorth: false,
    compact: true,
  });
}
