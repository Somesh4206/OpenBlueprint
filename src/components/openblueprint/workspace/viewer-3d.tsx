'use client';

// =========================================================================
// OpenBlueprint — 3D Viewer (Task 8)
// React Three Fiber + @react-three/drei visualization of a LayoutData model.
// 1 unit = 1 foot. Origin at the centre of the plot. +Y is up.
// =========================================================================

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import type {
  LayoutData,
  DesignStyle,
  RoomRect,
  DoorMarker,
  WindowMarker,
} from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Text,
  ContactShadows,
  Grid,
} from '@react-three/drei';
import * as THREE from 'three';

// =========================================================================
// Public API
// =========================================================================

export interface Viewer3DProps {
  layout: LayoutData;
  floor: number;
  showAllFloors: boolean;
  accentColor: string;
  style: DesignStyle;
  showWalls: boolean;
  showFurniture: boolean;
  showLabels: boolean;
  cameraView: 'orbit' | 'top' | 'front' | 'isometric';
}

export function Viewer3D(props: Viewer3DProps): React.JSX.Element {
  const { layout } = props;
  const plotW = layout.plot.width;
  const plotL = layout.plot.length;
  const maxDim = Math.max(plotW, plotL, 20);
  const initialCam: [number, number, number] = [
    maxDim * 0.85,
    maxDim * 0.85,
    maxDim * 1.1,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: initialCam, fov: 45, near: 0.1, far: 5000 }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

// =========================================================================
// Style configuration
// =========================================================================

interface StyleConfig {
  wallHeight: number;
  wallColor: string;
  wallRoughness: number;
  roofType: 'flat' | 'pitched' | 'overhang';
  roofOverhang: number;
  roofOpacity: number;
  windowTint: string;
  windowOpacity: number;
  windowScale: number;
  accentTrim: boolean;
  trimColor: string;
  slabThickness: number;
  slabColor: string;
  stairColor: string;
  furnitureColor: string;
}

const STYLE_CONFIG: Record<DesignStyle, StyleConfig> = {
  modern: {
    wallHeight: 9,
    wallColor: '#eceff2',
    wallRoughness: 0.7,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.32,
    windowTint: '#7fd4e8',
    windowOpacity: 0.55,
    windowScale: 1.25,
    accentTrim: false,
    trimColor: '#2b4a7a',
    slabThickness: 0.4,
    slabColor: '#cfd5da',
    stairColor: '#a8aeb4',
    furnitureColor: '#6b7280',
  },
  minimal: {
    wallHeight: 8,
    wallColor: '#d6d8db',
    wallRoughness: 0.9,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.28,
    windowTint: '#9fb6c0',
    windowOpacity: 0.45,
    windowScale: 1.0,
    accentTrim: false,
    trimColor: '#525252',
    slabThickness: 0.4,
    slabColor: '#c8cace',
    stairColor: '#9ca0a4',
    furnitureColor: '#7a7d80',
  },
  traditional: {
    wallHeight: 9,
    wallColor: '#d8c4a8',
    wallRoughness: 0.85,
    roofType: 'pitched',
    roofOverhang: 1.5,
    roofOpacity: 0.6,
    windowTint: '#9fc7d2',
    windowOpacity: 0.5,
    windowScale: 0.9,
    accentTrim: true,
    trimColor: '#6b4423',
    slabThickness: 0.4,
    slabColor: '#cab7a0',
    stairColor: '#a08a6e',
    furnitureColor: '#7a5a3a',
  },
  contemporary: {
    wallHeight: 9,
    wallColor: '#cfd3d8',
    wallRoughness: 0.55,
    roofType: 'overhang',
    roofOverhang: 3,
    roofOpacity: 0.4,
    windowTint: '#82d2e8',
    windowOpacity: 0.6,
    windowScale: 1.45,
    accentTrim: true,
    trimColor: '#3a3f4a',
    slabThickness: 0.4,
    slabColor: '#c2c6cb',
    stairColor: '#9aa0a6',
    furnitureColor: '#4a5258',
  },
  luxury: {
    wallHeight: 10.5,
    wallColor: '#ece4d4',
    wallRoughness: 0.45,
    roofType: 'flat',
    roofOverhang: 2,
    roofOpacity: 0.32,
    windowTint: '#88dcec',
    windowOpacity: 0.62,
    windowScale: 1.55,
    accentTrim: true,
    trimColor: '#9b7a3a',
    slabThickness: 0.5,
    slabColor: '#d8cdb5',
    stairColor: '#a89a78',
    furnitureColor: '#7a6a4a',
  },
};

const WALL_THICKNESS = 0.3;
const DOOR_HEIGHT = 7;
const WINDOW_BASE_HEIGHT = 3.5;
const WINDOW_BOTTOM = 3;

// =========================================================================
// Geometry helpers
// =========================================================================

function to3DX(x: number, plotWidth: number): number {
  return x - plotWidth / 2;
}
function to3DZ(y: number, plotLength: number): number {
  return y - plotLength / 2;
}

interface Segment {
  start: number;
  end: number;
}

/** Split a 1-D wall run by door openings (pos is 0..1 along the wall). */
function splitWallByOpenings(
  wallLength: number,
  openings: { pos: number; width: number }[],
): Segment[] {
  if (wallLength <= 0) return [];
  if (openings.length === 0) return [{ start: 0, end: wallLength }];
  const sorted = openings
    .map((o) => ({
      start: o.pos * wallLength - o.width / 2,
      end: o.pos * wallLength + o.width / 2,
    }))
    .filter((o) => o.end > 0.05 && o.start < wallLength - 0.05)
    .map((o) => ({
      start: Math.max(0, o.start),
      end: Math.min(wallLength, o.end),
    }))
    .sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const o of sorted) {
    if (o.start > cursor + 0.05) segments.push({ start: cursor, end: o.start });
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < wallLength - 0.05) segments.push({ start: cursor, end: wallLength });
  return segments.filter((s) => s.end - s.start > 0.05);
}

function doorsOn(room: RoomRect, wall: 'top' | 'right' | 'bottom' | 'left') {
  return room.doors.filter((d) => d.wall === wall);
}
function windowsOn(room: RoomRect, wall: 'top' | 'right' | 'bottom' | 'left') {
  return room.windows.filter((w) => w.wall === wall);
}

// =========================================================================
// Computed scene model
// =========================================================================

interface BoxData {
  position: [number, number, number];
  size: [number, number, number];
}
interface SlabData {
  position: [number, number, number];
  size: [number, number];
  color: string;
}
interface LabelData {
  position: [number, number, number];
  text: string;
  subtext: string;
  color: string;
}
interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
interface ComputedScene {
  floorSlabs: SlabData[];
  interFloorSlabs: SlabData[];
  walls: BoxData[];
  trims: BoxData[];
  windows: BoxData[];
  doorPanels: BoxData[];
  stairs: BoxData[];
  furniture: BoxData[];
  labels: LabelData[];
  footprint: Footprint | null;
  totalBuildingHeight: number;
  roofY: number;
}

function computeScene(
  layout: LayoutData,
  floor: number,
  showAllFloors: boolean,
  style: DesignStyle,
  showWalls: boolean,
  showFurniture: boolean,
): ComputedScene {
  const cfg = STYLE_CONFIG[style];
  const wallHeight = cfg.wallHeight;
  const floorHeight = wallHeight + cfg.slabThickness;
  const plotW = layout.plot.width;
  const plotL = layout.plot.length;

  const floorsRendered: number[] = [];
  if (showAllFloors) {
    for (let f = 0; f < layout.floors; f++) floorsRendered.push(f);
  } else {
    // Always include the requested floor (clamp to valid range).
    const f = Math.max(0, Math.min(floor, Math.max(0, layout.floors - 1)));
    floorsRendered.push(f);
  }
  const floorBaseYs = floorsRendered.map((f) => f * floorHeight);

  const floorSlabs: SlabData[] = [];
  const interFloorSlabs: SlabData[] = [];
  const walls: BoxData[] = [];
  const trims: BoxData[] = [];
  const windows: BoxData[] = [];
  const doorPanels: BoxData[] = [];
  const stairs: BoxData[] = [];
  const furniture: BoxData[] = [];
  const labels: LabelData[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  floorsRendered.forEach((f, idx) => {
    const baseY = floorBaseYs[idx];
    const floorRooms = layout.rooms.filter((r) => r.floor === f);

    // Footprint of this floor (for inter-floor slab).
    let fMinX = Infinity;
    let fMaxX = -Infinity;
    let fMinZ = Infinity;
    let fMaxZ = -Infinity;

    floorRooms.forEach((room) => {
      const cx = to3DX(room.x + room.width / 2, plotW);
      const cz = to3DZ(room.y + room.length / 2, plotL);
      const isStaircase = room.type === 'staircase';
      const isOpenAir = room.type === 'parking' || room.type === 'balcony';
      const catalog = ROOM_CATALOG[room.type];

      // Floor slab (per-room, colored by catalog color).
      const slabColor = isOpenAir ? '#cfcfcf' : catalog?.color ?? '#e8e8e8';
      floorSlabs.push({
        position: [cx, baseY + 0.02, cz],
        size: [room.width, room.length],
        color: slabColor,
      });

      // Track footprints.
      const rMinX = to3DX(room.x, plotW);
      const rMaxX = to3DX(room.x + room.width, plotW);
      const rMinZ = to3DZ(room.y, plotL);
      const rMaxZ = to3DZ(room.y + room.length, plotL);
      minX = Math.min(minX, rMinX);
      maxX = Math.max(maxX, rMaxX);
      minZ = Math.min(minZ, rMinZ);
      maxZ = Math.max(maxZ, rMaxZ);
      fMinX = Math.min(fMinX, rMinX);
      fMaxX = Math.max(fMaxX, rMaxX);
      fMinZ = Math.min(fMinZ, rMinZ);
      fMaxZ = Math.max(fMaxZ, rMaxZ);

      // Walls (skip open-air rooms like parking/balcony).
      if (showWalls && !isOpenAir) {
        addRoomWalls(
          room,
          baseY,
          wallHeight,
          plotW,
          plotL,
          walls,
          trims,
          windows,
          doorPanels,
          cfg,
          isStaircase,
        );
      }

      // Staircase steps.
      if (isStaircase) {
        addStairs(room, baseY, plotW, plotL, stairs);
      }

      // Furniture.
      if (showFurniture && !isStaircase && !isOpenAir) {
        addFurniture(room, baseY, plotW, plotL, furniture);
      }

      // Floating label.
      labels.push({
        position: [cx, baseY + wallHeight + 0.6, cz],
        text: room.name,
        subtext: `${room.width.toFixed(1)}\u00A0\u00D7\u00A0${room.length.toFixed(1)}\u00A0ft`,
        color: catalog?.accent ?? '#2b4a7a',
      });
    });

    // Inter-floor slab (only between this floor and the next).
    if (showAllFloors && idx < floorsRendered.length - 1 && fMinX < Infinity) {
      const slabY = baseY + wallHeight + cfg.slabThickness / 2;
      interFloorSlabs.push({
        position: [(fMinX + fMaxX) / 2, slabY, (fMinZ + fMaxZ) / 2],
        size: [fMaxX - fMinX, fMaxZ - fMinZ],
        color: cfg.slabColor,
      });
    }
  });

  const footprint: Footprint | null =
    minX < Infinity ? { minX, maxX, minZ, maxZ } : null;
  const lastBaseY = floorBaseYs[floorBaseYs.length - 1] ?? 0;
  const totalBuildingHeight = lastBaseY + wallHeight;
  const roofY = lastBaseY + wallHeight + 0.15;

  return {
    floorSlabs,
    interFloorSlabs,
    walls,
    trims,
    windows,
    doorPanels,
    stairs,
    furniture,
    labels,
    footprint,
    totalBuildingHeight,
    roofY,
  };
}

// -------------------------------------------------------------------------
// Wall builder — emits thin shell segments around each room perimeter,
// leaving gaps for doors. Windows are rendered as translucent overlays.
// -------------------------------------------------------------------------

function addRoomWalls(
  room: RoomRect,
  baseY: number,
  wallHeight: number,
  plotW: number,
  plotL: number,
  walls: BoxData[],
  trims: BoxData[],
  windows: BoxData[],
  doorPanels: BoxData[],
  cfg: StyleConfig,
  isStaircase: boolean,
) {
  const wallCenterY = baseY + wallHeight / 2;
  // Staircase rooms have a half-height balustrade instead of a full wall on
  // the open side, but to keep things simple we render full walls and let
  // the steps read visually.
  void isStaircase;

  // ---- TOP wall: along X, at z = to3DZ(room.y) ----
  buildAxisWall({
    axis: 'x',
    fixedCoord: to3DZ(room.y, plotL),
    startCoord: to3DX(room.x, plotW),
    length: room.width,
    doors: doorsOn(room, 'top'),
    wins: windowsOn(room, 'top'),
    baseY,
    wallHeight,
    wallCenterY,
    walls,
    trims,
    windows,
    doorPanels,
    cfg,
  });

  // ---- BOTTOM wall: along X, at z = to3DZ(room.y + room.length) ----
  buildAxisWall({
    axis: 'x',
    fixedCoord: to3DZ(room.y + room.length, plotL),
    startCoord: to3DX(room.x, plotW),
    length: room.width,
    doors: doorsOn(room, 'bottom'),
    wins: windowsOn(room, 'bottom'),
    baseY,
    wallHeight,
    wallCenterY,
    walls,
    trims,
    windows,
    doorPanels,
    cfg,
  });

  // ---- LEFT wall: along Z, at x = to3DX(room.x) ----
  buildAxisWall({
    axis: 'z',
    fixedCoord: to3DX(room.x, plotW),
    startCoord: to3DZ(room.y, plotL),
    length: room.length,
    doors: doorsOn(room, 'left'),
    wins: windowsOn(room, 'left'),
    baseY,
    wallHeight,
    wallCenterY,
    walls,
    trims,
    windows,
    doorPanels,
    cfg,
  });

  // ---- RIGHT wall: along Z, at x = to3DX(room.x + room.width) ----
  buildAxisWall({
    axis: 'z',
    fixedCoord: to3DX(room.x + room.width, plotW),
    startCoord: to3DZ(room.y, plotL),
    length: room.length,
    doors: doorsOn(room, 'right'),
    wins: windowsOn(room, 'right'),
    baseY,
    wallHeight,
    wallCenterY,
    walls,
    trims,
    windows,
    doorPanels,
    cfg,
  });
}

interface AxisWallArgs {
  axis: 'x' | 'z';
  fixedCoord: number;
  startCoord: number;
  length: number;
  doors: DoorMarker[];
  wins: WindowMarker[];
  baseY: number;
  wallHeight: number;
  wallCenterY: number;
  walls: BoxData[];
  trims: BoxData[];
  windows: BoxData[];
  doorPanels: BoxData[];
  cfg: StyleConfig;
}

function buildAxisWall(a: AxisWallArgs) {
  const segments = splitWallByOpenings(
    a.length,
    a.doors.map((d) => ({ pos: d.pos, width: d.width })),
  );
  const isX = a.axis === 'x';

  for (const seg of segments) {
    const segStartWorld = a.startCoord + seg.start;
    const segEndWorld = a.startCoord + seg.end;
    const center = (segStartWorld + segEndWorld) / 2;
    const span = segEndWorld - segStartWorld;
    if (span <= 0.05) continue;

    if (isX) {
      a.walls.push({
        position: [center, a.wallCenterY, a.fixedCoord],
        size: [span, a.wallHeight, WALL_THICKNESS],
      });
      // Top accent trim
      if (a.cfg.accentTrim) {
        a.trims.push({
          position: [center, a.baseY + a.wallHeight + 0.1, a.fixedCoord],
          size: [span, 0.2, WALL_THICKNESS * 1.05],
        });
      }
    } else {
      a.walls.push({
        position: [a.fixedCoord, a.wallCenterY, center],
        size: [WALL_THICKNESS, a.wallHeight, span],
      });
      if (a.cfg.accentTrim) {
        a.trims.push({
          position: [a.fixedCoord, a.baseY + a.wallHeight + 0.1, center],
          size: [WALL_THICKNESS * 1.05, 0.2, span],
        });
      }
    }
  }

  // Windows (translucent overlays on the wall surface).
  for (const win of a.wins) {
    const wWidth = Math.min(win.width * a.cfg.windowScale, a.length * 0.7);
    const center = a.startCoord + win.pos * a.length;
    const winHeight = WINDOW_BASE_HEIGHT * a.cfg.windowScale;
    const winY = a.baseY + WINDOW_BOTTOM + winHeight / 2;
    const thick = WALL_THICKNESS * 1.5;
    if (isX) {
      a.windows.push({
        position: [center, winY, a.fixedCoord],
        size: [wWidth, winHeight, thick],
      });
    } else {
      a.windows.push({
        position: [a.fixedCoord, winY, center],
        size: [thick, winHeight, wWidth],
      });
    }
  }

  // Door panels (thin door leaf at the door position).
  for (const d of a.doors) {
    const center = a.startCoord + d.pos * a.length;
    const panelThick = WALL_THICKNESS * 0.55;
    if (isX) {
      a.doorPanels.push({
        position: [center, a.baseY + DOOR_HEIGHT / 2, a.fixedCoord],
        size: [d.width * 0.92, DOOR_HEIGHT, panelThick],
      });
    } else {
      a.doorPanels.push({
        position: [a.fixedCoord, a.baseY + DOOR_HEIGHT / 2, center],
        size: [panelThick, DOOR_HEIGHT, d.width * 0.92],
      });
    }
  }
}

// -------------------------------------------------------------------------
// Stairs — a flight of ascending steps rising half the wall height.
// -------------------------------------------------------------------------

function addStairs(
  room: RoomRect,
  baseY: number,
  plotW: number,
  plotL: number,
  stairs: BoxData[],
) {
  const cx = to3DX(room.x + room.width / 2, plotW);
  const cz = to3DZ(room.y + room.length / 2, plotL);
  const stepCount = 7;
  const stepHeight = 0.55;
  const stepDepth = room.length / stepCount;
  const stepWidth = Math.min(room.width * 0.7, 4);
  const startZ = cz - room.length / 2 + stepDepth / 2;
  for (let i = 0; i < stepCount; i++) {
    stairs.push({
      position: [cx, baseY + (stepHeight * (i + 1)) / 2, startZ + i * stepDepth],
      size: [stepWidth, stepHeight * (i + 1), stepDepth * 0.95],
    });
  }
}

// -------------------------------------------------------------------------
// Furniture — minimal box proxies to suggest room function.
// -------------------------------------------------------------------------

function addFurniture(
  room: RoomRect,
  baseY: number,
  plotW: number,
  plotL: number,
  furniture: BoxData[],
) {
  const cx = to3DX(room.x + room.width / 2, plotW);
  const cz = to3DZ(room.y + room.length / 2, plotL);
  const w = room.width;
  const l = room.length;

  switch (room.type) {
    case 'bedroom': {
      const bedW = Math.min(w * 0.55, 6);
      const bedL = Math.min(l * 0.5, 7);
      const bedX = to3DX(room.x + bedW / 2 + 0.5, plotW);
      const bedZ = to3DZ(room.y + l - bedL / 2 - 0.5, plotL);
      furniture.push({
        position: [bedX, baseY + 1, bedZ],
        size: [bedW, 2, bedL],
      });
      // Wardrobe
      furniture.push({
        position: [to3DX(room.x + 1, plotW), baseY + 3, to3DZ(room.y + 1.5, plotL)],
        size: [1.5, 6, 3],
      });
      break;
    }
    case 'living': {
      const sofaW = Math.min(w * 0.7, 8);
      furniture.push({
        position: [cx, baseY + 1, to3DZ(room.y + l - 1.5, plotL)],
        size: [sofaW, 1.8, 2.5],
      });
      // Coffee table
      furniture.push({
        position: [cx, baseY + 0.7, cz],
        size: [3.5, 1.4, 2],
      });
      // TV unit
      furniture.push({
        position: [to3DX(room.x + 1, plotW), baseY + 2, cz],
        size: [1, 4, Math.min(l * 0.6, 6)],
      });
      break;
    }
    case 'dining': {
      const tW = Math.min(w * 0.5, 4);
      const tL = Math.min(l * 0.4, 6);
      furniture.push({
        position: [cx, baseY + 1.5, cz],
        size: [tW, 3, tL],
      });
      // Four chairs
      const chairPositions: [number, number][] = [
        [cx, cz - tL / 2 - 1],
        [cx, cz + tL / 2 + 1],
        [cx - tW / 2 - 1, cz],
        [cx + tW / 2 + 1, cz],
      ];
      for (const [px, pz] of chairPositions) {
        furniture.push({
          position: [px, baseY + 1, pz],
          size: [1.4, 2, 1.4],
        });
      }
      break;
    }
    case 'kitchen': {
      // Counter along left wall
      const counterL = Math.min(l * 0.85, l - 1);
      furniture.push({
        position: [to3DX(room.x + 1, plotW), baseY + 1.5, cz],
        size: [1.5, 3, counterL],
      });
      // Island
      if (w > 9) {
        furniture.push({
          position: [cx + 1.5, baseY + 1.5, cz],
          size: [3, 3, Math.min(l * 0.5, 4)],
        });
      }
      break;
    }
    case 'office': {
      furniture.push({
        position: [to3DX(room.x + 1.5, plotW), baseY + 1.3, to3DZ(room.y + 1.5, plotL)],
        size: [3.5, 2.6, 2],
      });
      // Chair
      furniture.push({
        position: [to3DX(room.x + 1.5, plotW), baseY + 1, to3DZ(room.y + 3.5, plotL)],
        size: [1.5, 2, 1.5],
      });
      break;
    }
    case 'bathroom': {
      // Sink
      furniture.push({
        position: [cx - w * 0.2, baseY + 1.5, to3DZ(room.y + 1, plotL)],
        size: [1.5, 3, 1.2],
      });
      // Toilet
      furniture.push({
        position: [cx + w * 0.25, baseY + 0.8, to3DZ(room.y + 1, plotL)],
        size: [1.2, 1.6, 1.6],
      });
      break;
    }
    case 'pooja': {
      furniture.push({
        position: [cx, baseY + 1.5, to3DZ(room.y + 0.8, plotL)],
        size: [w * 0.6, 3, 0.8],
      });
      break;
    }
    case 'utility': {
      furniture.push({
        position: [to3DX(room.x + 1, plotW), baseY + 1.5, cz],
        size: [1.5, 3, Math.min(l * 0.7, 4)],
      });
      break;
    }
    case 'store': {
      furniture.push({
        position: [to3DX(room.x + 1, plotW), baseY + 2, cz],
        size: [1.5, 4, Math.min(l * 0.7, 3)],
      });
      break;
    }
    case 'foyer': {
      // Small console table
      furniture.push({
        position: [cx, baseY + 1.2, to3DZ(room.y + 1, plotL)],
        size: [Math.min(w * 0.6, 3), 2.4, 0.8],
      });
      break;
    }
    default:
      break;
  }
}

// =========================================================================
// React components
// =========================================================================

function Roof({
  footprint,
  y,
  style,
  accentColor,
}: {
  footprint: Footprint;
  y: number;
  style: DesignStyle;
  accentColor: string;
}) {
  const cfg = STYLE_CONFIG[style];
  const width = footprint.maxX - footprint.minX;
  const depth = footprint.maxZ - footprint.minZ;
  const cx = (footprint.minX + footprint.maxX) / 2;
  const cz = (footprint.minZ + footprint.maxZ) / 2;
  const overhang = cfg.roofOverhang;
  const opacity = cfg.roofOpacity;

  const pitchedGeom = useMemo(() => {
    if (cfg.roofType !== 'pitched') return null;
    const base = width + overhang * 2;
    const apex = Math.min(width, depth) * 0.4;
    const shape = new THREE.Shape();
    shape.moveTo(-base / 2, 0);
    shape.lineTo(base / 2, 0);
    shape.lineTo(0, apex);
    shape.closePath();
    const extrudeDepth = depth + overhang * 2;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: extrudeDepth,
      bevelEnabled: false,
    });
    g.translate(0, 0, -extrudeDepth / 2);
    g.computeVertexNormals();
    return g;
  }, [cfg.roofType, width, depth, overhang]);

  if (cfg.roofType === 'pitched' && pitchedGeom) {
    return (
      <mesh geometry={pitchedGeom} position={[cx, y, cz]} castShadow receiveShadow>
        <meshStandardMaterial
          color={accentColor}
          transparent
          opacity={opacity}
          roughness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  // Flat or overhang roof — thin slab.
  return (
    <mesh position={[cx, y, cz]} castShadow receiveShadow>
      <boxGeometry args={[width + overhang * 2, 0.3, depth + overhang * 2]} />
      <meshStandardMaterial
        color={accentColor}
        transparent
        opacity={opacity}
        roughness={0.6}
      />
    </mesh>
  );
}

function Label3D({ label }: { label: LabelData }) {
  return (
    <Html
      position={label.position}
      center
      distanceFactor={28}
      zIndexRange={[10, 0]}
      wrapperClass="ob-label"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          padding: '3px 8px',
          background: 'rgba(255,255,255,0.92)',
          border: `1.5px solid ${label.color}`,
          borderRadius: '6px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          color: label.color,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          textAlign: 'center',
          transform: 'translate3d(-50%, -50%, 0)',
        }}
      >
        <div>{label.text}</div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 500,
            color: '#52525b',
            marginTop: '1px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {label.subtext}
        </div>
      </div>
    </Html>
  );
}

function Building({
  scene,
  style,
  accentColor,
  showLabels,
}: {
  scene: ComputedScene;
  style: DesignStyle;
  accentColor: string;
  showLabels: boolean;
}) {
  const cfg = STYLE_CONFIG[style];
  return (
    <group>
      {/* Per-room floor slabs */}
      {scene.floorSlabs.map((s, i) => (
        <mesh
          key={`fs-${i}`}
          position={s.position}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[s.size[0], s.size[1]]} />
          <meshStandardMaterial
            color={s.color}
            roughness={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Inter-floor ceiling slabs (multi-floor mode) */}
      {scene.interFloorSlabs.map((s, i) => (
        <mesh
          key={`is-${i}`}
          position={s.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[s.size[0], cfg.slabThickness, s.size[1]]} />
          <meshStandardMaterial color={s.color} roughness={0.85} />
        </mesh>
      ))}

      {/* Walls (thin shells) */}
      {scene.walls.map((w, i) => (
        <mesh key={`w-${i}`} position={w.position} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          <meshStandardMaterial
            color={cfg.wallColor}
            roughness={cfg.wallRoughness}
          />
        </mesh>
      ))}

      {/* Accent trims */}
      {scene.trims.map((t, i) => (
        <mesh key={`t-${i}`} position={t.position}>
          <boxGeometry args={t.size} />
          <meshStandardMaterial color={cfg.trimColor} roughness={0.5} />
        </mesh>
      ))}

      {/* Windows (translucent overlays) */}
      {scene.windows.map((w, i) => (
        <mesh key={`win-${i}`} position={w.position}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial
            color={cfg.windowTint}
            transparent
            opacity={cfg.windowOpacity}
            roughness={0.1}
            metalness={0.35}
          />
        </mesh>
      ))}

      {/* Door panels */}
      {scene.doorPanels.map((d, i) => (
        <mesh key={`dp-${i}`} position={d.position} castShadow>
          <boxGeometry args={d.size} />
          <meshStandardMaterial color={cfg.trimColor} roughness={0.55} />
        </mesh>
      ))}

      {/* Staircase steps */}
      {scene.stairs.map((s, i) => (
        <mesh key={`st-${i}`} position={s.position} castShadow receiveShadow>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={cfg.stairColor} roughness={0.85} />
        </mesh>
      ))}

      {/* Furniture */}
      {scene.furniture.map((f, i) => (
        <mesh key={`fn-${i}`} position={f.position} castShadow receiveShadow>
          <boxGeometry args={f.size} />
          <meshStandardMaterial color={cfg.furnitureColor} roughness={0.75} />
        </mesh>
      ))}

      {/* Roof */}
      {scene.footprint && (
        <Roof
          footprint={scene.footprint}
          y={scene.roofY}
          style={style}
          accentColor={accentColor}
        />
      )}

      {/* Floating labels */}
      {showLabels &&
        scene.labels.map((l, i) => <Label3D key={`lb-${i}`} label={l} />)}
    </group>
  );
}

// -------------------------------------------------------------------------
// North arrow — flat disc with an arrow rotated to the plot's north bearing.
// -------------------------------------------------------------------------

function NorthArrow({
  plotWidth,
  plotLength,
  northDirection,
}: {
  plotWidth: number;
  plotLength: number;
  northDirection: number;
}) {
  const px = -plotWidth / 2 + 2.5;
  const pz = -plotLength / 2 + 2.5;
  const angle = (northDirection * Math.PI) / 180;
  // 2D north (0 = up) maps to 3D direction (sin θ, 0, -cos θ).
  // Y-rotation that orients the local +X axis toward that direction:
  //   θ_rot = atan2(cos θ, sin θ)
  const yRotation = Math.atan2(Math.cos(angle), Math.sin(angle));
  const labelX = Math.sin(angle) * 2.6;
  const labelZ = -Math.cos(angle) * 2.6;

  return (
    <group position={[px, 0, pz]}>
      {/* Disc base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <circleGeometry args={[1.9, 28]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>
      {/* Arrow */}
      <group position={[0, 0.08, 0]} rotation={[0, yRotation, 0]}>
        <mesh position={[1.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.42, 1.3, 4]} />
          <meshStandardMaterial color="#1e3a5f" roughness={0.5} />
        </mesh>
        <mesh position={[0.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 1.6, 8]} />
          <meshStandardMaterial color="#1e3a5f" roughness={0.5} />
        </mesh>
      </group>
      {/* N label */}
      <Text
        position={[labelX, 0.12, labelZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.95}
        color="#1e3a5f"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
        N
      </Text>
    </group>
  );
}

// -------------------------------------------------------------------------
// Plot outline — a thin wireframe rectangle on the ground.
// -------------------------------------------------------------------------

function PlotOutline({
  width,
  length,
}: {
  width: number;
  length: number;
}) {
  const geom = useMemo(() => {
    const box = new THREE.BoxGeometry(width, 0.02, length);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, length]);

  return (
    <lineSegments geometry={geom} position={[0, 0.03, 0]}>
      <lineBasicMaterial color="#2b4a7a" transparent opacity={0.65} />
    </lineSegments>
  );
}

// -------------------------------------------------------------------------
// 3D bounding-box wireframe above the building (subtle vertical extents).
// -------------------------------------------------------------------------

function BoundingBox({
  footprint,
  buildingHeight,
}: {
  footprint: Footprint | null;
  buildingHeight: number;
}) {
  const geom = useMemo(() => {
    if (!footprint) return null;
    const w = footprint.maxX - footprint.minX;
    const d = footprint.maxZ - footprint.minZ;
    const cx = (footprint.minX + footprint.maxX) / 2;
    const cz = (footprint.minZ + footprint.maxZ) / 2;
    const box = new THREE.BoxGeometry(w + 0.4, buildingHeight + 0.4, d + 0.4);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', edges.getAttribute('position'));
    g.setIndex(edges.getIndex());
    edges.dispose();
    return { geom: g, cx, cz };
  }, [footprint, buildingHeight]);

  if (!geom) return null;
  return (
    <lineSegments
      geometry={geom.geom}
      position={[geom.cx, buildingHeight / 2, geom.cz]}
    >
      <lineBasicMaterial color="#2b4a7a" transparent opacity={0.25} />
    </lineSegments>
  );
}

// =========================================================================
// Camera rig — animates the camera (and OrbitControls target) when
// `cameraView` changes. The animation auto-stops after a fixed number of
// frames OR when the user starts interacting with the controls.
// =========================================================================

function CameraRig({
  cameraView,
  plotWidth,
  plotLength,
  buildingHeight,
}: {
  cameraView: 'orbit' | 'top' | 'front' | 'isometric';
  plotWidth: number;
  plotLength: number;
  buildingHeight: number;
}) {
  const { camera, controls } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3(0, buildingHeight * 0.3, 0));
  const animFrames = useRef(0);
  const lerpFactor = 0.12;

  // Recompute target whenever inputs change.
  useEffect(() => {
    const maxDim = Math.max(plotWidth, plotLength, 20);
    const h = Math.max(buildingHeight, maxDim * 0.4);
    switch (cameraView) {
      case 'top':
        targetPos.current.set(0.01, maxDim * 1.55, 0.01);
        targetLookAt.current.set(0, 0, 0);
        break;
      case 'front':
        targetPos.current.set(0, h * 0.55, maxDim * 1.25);
        targetLookAt.current.set(0, h * 0.45, 0);
        break;
      case 'isometric':
        targetPos.current.set(
          maxDim * 0.95,
          maxDim * 1.0,
          maxDim * 0.95,
        );
        targetLookAt.current.set(0, h * 0.35, 0);
        break;
      case 'orbit':
      default:
        targetPos.current.set(
          maxDim * 0.8,
          h + maxDim * 0.45,
          maxDim * 1.05,
        );
        targetLookAt.current.set(0, h * 0.3, 0);
        break;
    }
    animFrames.current = 75; // ~1.25s of animation at 60fps
  }, [cameraView, plotWidth, plotLength, buildingHeight]);

  // Cancel animation when user starts dragging.
  useEffect(() => {
    const c = controls as { addEventListener?: (e: string, fn: () => void) => void; removeEventListener?: (e: string, fn: () => void) => void } | null;
    if (!c || !c.addEventListener) return;
    const onStart = () => {
      animFrames.current = 0;
    };
    c.addEventListener('start', onStart);
    return () => {
      c.removeEventListener?.('start', onStart);
    };
  }, [controls]);

  useFrame(() => {
    if (animFrames.current <= 0) return;
    animFrames.current -= 1;
    camera.position.lerp(targetPos.current, lerpFactor);
    const c = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (c?.target && c?.update) {
      c.target.lerp(targetLookAt.current, lerpFactor);
      c.update();
    } else {
      camera.lookAt(targetLookAt.current);
    }
  });

  return null;
}

// =========================================================================
// Scene — lights, ground, grid, building, north arrow, contact shadows.
// =========================================================================

function Scene(props: Viewer3DProps) {
  const {
    layout,
    floor,
    showAllFloors,
    accentColor,
    style,
    showWalls,
    showFurniture,
    showLabels,
    cameraView,
  } = props;

  const plotW = layout.plot.width;
  const plotL = layout.plot.length;

  const scene = useMemo(
    () =>
      computeScene(
        layout,
        floor,
        showAllFloors,
        style,
        showWalls,
        showFurniture,
      ),
    [layout, floor, showAllFloors, style, showWalls, showFurniture],
  );

  const buildingHeight = Math.max(
    scene.totalBuildingHeight,
    STYLE_CONFIG[style].wallHeight,
  );
  const maxDim = Math.max(plotW, plotL, 20);

  return (
    <>
      <color attach="background" args={['#eef0f3']} />
      <fog
        attach="fog"
        args={['#eef0f3', maxDim * 2.2, maxDim * 5.5]}
      />

      {/* Lighting: soft architectural setup */}
      <hemisphereLight args={['#ffffff', '#b5bcc4', 0.55]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[plotW * 0.7, buildingHeight + 35, plotL * 0.55]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-maxDim}
        shadow-camera-right={maxDim}
        shadow-camera-top={maxDim}
        shadow-camera-bottom={-maxDim}
        shadow-camera-near={0.5}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />

      <CameraRig
        cameraView={cameraView}
        plotWidth={plotW}
        plotLength={plotL}
        buildingHeight={buildingHeight}
      />

      {/* Building */}
      <Building
        scene={scene}
        style={style}
        accentColor={accentColor}
        showLabels={showLabels}
      />

      {/* Plot ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[plotW, plotL]} />
        <meshStandardMaterial color="#d4dcd0" roughness={0.95} />
      </mesh>

      {/* Subtle grid extending past the plot */}
      <Grid
        position={[0, 0.015, 0]}
        args={[maxDim * 2.4, maxDim * 2.4]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#9aa6b0"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={maxDim * 2.4}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Plot outline */}
      <PlotOutline width={plotW} length={plotL} />

      {/* Building bounding box wireframe */}
      <BoundingBox
        footprint={scene.footprint}
        buildingHeight={buildingHeight}
      />

      {/* North arrow */}
      <NorthArrow
        plotWidth={plotW}
        plotLength={plotL}
        northDirection={layout.plot.northDirection}
      />

      {/* Soft contact shadow under the building */}
      <ContactShadows
        position={[0, 0.025, 0]}
        scale={maxDim * 2}
        far={buildingHeight + 12}
        resolution={1024}
        blur={2.5}
        opacity={0.42}
        color="#1a2433"
      />

      {/* A faint accent fill light so the accent color reads in shadows */}
      <pointLight
        position={[0, buildingHeight + 6, 0]}
        intensity={0.15}
        color={accentColor}
        distance={maxDim * 2}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        minDistance={Math.max(8, maxDim * 0.15)}
        maxDistance={maxDim * 4}
        maxPolarAngle={Math.PI / 2.02}
        screenSpacePanning={false}
      />
    </>
  );
}

export default Viewer3D;
