'use client';

// =========================================================================
// OpenBlueprint — 3D Viewer (Task 8-b clean rebuild)
// React Three Fiber + @react-three/drei architectural visualization.
//
// Design goal: BRIGHT, CLEAN, PROFESSIONAL — like a SketchUp + V-Ray render
// or a clean Twinmotion output. NOT dull, NOT flat, NOT washed out.
//
// Visual stack:
//   • drei <Sky> real atmospheric sky (soft blue gradient + sun glow)
//   • <Environment preset="city"> image-based lighting for crisp reflections
//   • Bright ambient (0.8) + hemisphere (0.7) + key sun (1.5) + soft fill (0.5)
//   • ACES Filmic tone mapping, exposure 1.3 (brighter, cinematic)
//   • 300×300 light concrete ground (#d4d8de, roughness 0.95)
//   • Subtle infinite <Grid> (cell 2 / section 10, fadeDistance 120)
//   • <ContactShadows> for soft ambient-occlusion grounding
//   • Thin-shell walls (0.5ft) with real door gaps, semi-transparent in
//     single-floor cutaway view so furniture is clearly visible
//   • Polished-tile floor slabs (roughness 0.4, metalness 0.05) with a
//     subtle darker grout-line border for a real tile look
//   • Glossy translucent cyan glass windows (roughness 0.05, metalness 0.2)
//   • Warm-wood door panels, modelled as hinged leaves rotated 30° ajar
//   • Flat / overhang / pitched roofs per design style
//   • Furniture rendered through <FurnitureMesh3D> (beds, sofas, counters,
//     car, bike, etc.)
//   • Floating HTML room labels — clean white pills with accent left border
//   • 3D north arrow + accent plot outline
//   • Smooth animated camera rig with 4 presets (orbit / iso / front / top)
//
// Coordinate convention (matches furniture-3d.tsx):
//   - 1 unit = 1 foot
//   - Origin at the centre of the plot, +Y is up
//   - worldX = item.x + item.width/2 - plot.width/2
//   - worldZ = item.y + item.length/2 - plot.length/2
// =========================================================================

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import type {
  LayoutData,
  DesignStyle,
  RoomRect,
  DoorMarker,
  WindowMarker,
  FurnitureItem,
} from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Text,
  ContactShadows,
  Grid,
  Environment,
  Sky,
} from '@react-three/drei';
import * as THREE from 'three';
import { FurnitureMesh3D } from './furniture-3d';

// =========================================================================
// Public API  (signature MUST stay exactly like this — parent depends on it)
// =========================================================================

export interface Viewer3DProps {
  layout: LayoutData;
  floor: number; // 0-indexed floor to display
  showAllFloors: boolean;
  accentColor: string;
  style: DesignStyle; // 'modern' | 'minimal' | 'traditional' | 'contemporary' | 'luxury'
  showWalls: boolean;
  showFurniture: boolean;
  showLabels: boolean;
  cameraView: 'orbit' | 'top' | 'front' | 'isometric';
}

export function Viewer3D(props: Viewer3DProps): React.JSX.Element {
  const { layout } = props;
  const plotW = layout.plot.width;
  // Initial camera roughly at the orbit preset so first paint matches the rig.
  const initialCam: [number, number, number] = [
    plotW * 0.75,
    plotW * 0.65,
    plotW * 0.85,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
        preserveDrawingBuffer: true,
      }}
      camera={{ position: initialCam, fov: 45, near: 0.1, far: 2000 }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

export default Viewer3D;

// =========================================================================
// Style configuration
//   Per spec:
//     modern:       wall #f5f3ee, height 9,   flat roof
//     minimal:      wall #fafafa, height 8.5, flat roof
//     traditional:  wall #ede4d3, height 9.5, pitched roof (warm #7d4f2a)
//     contemporary: wall #f0ece4, height 10,  flat roof with overhang
//     luxury:       wall #f8f4ea, height 10.5, flat roof
// =========================================================================

interface StyleConfig {
  wallHeight: number;
  wallColor: string;
  wallRoughness: number;
  roofType: 'flat' | 'pitched' | 'overhang';
  roofOverhang: number;
  roofOpacity: number;
  windowScale: number;
  accentTrim: boolean;
  trimColor: string;
  slabColor: string;
  stairColor: string;
  pitchedRoofColor: string;
}

const STYLE_CONFIG: Record<DesignStyle, StyleConfig> = {
  modern: {
    wallHeight: 9,
    wallColor: '#f5f3ee',
    wallRoughness: 0.75,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.4,
    windowScale: 1.0,
    accentTrim: false,
    trimColor: '#2b4a7a',
    slabColor: '#cfd5da',
    stairColor: '#a8aeb4',
    pitchedRoofColor: '#7d4f2a',
  },
  minimal: {
    wallHeight: 8.5,
    wallColor: '#fafafa',
    wallRoughness: 0.8,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.4,
    windowScale: 0.95,
    accentTrim: false,
    trimColor: '#525252',
    slabColor: '#c8cace',
    stairColor: '#9ca0a4',
    pitchedRoofColor: '#7d4f2a',
  },
  traditional: {
    wallHeight: 9.5,
    wallColor: '#ede4d3',
    wallRoughness: 0.78,
    roofType: 'pitched',
    roofOverhang: 1.5,
    roofOpacity: 0.85,
    windowScale: 0.9,
    accentTrim: true,
    trimColor: '#6b4423',
    slabColor: '#cab7a0',
    stairColor: '#a08a6e',
    pitchedRoofColor: '#7d4f2a',
  },
  contemporary: {
    wallHeight: 10,
    wallColor: '#f0ece4',
    wallRoughness: 0.7,
    roofType: 'overhang',
    roofOverhang: 3,
    roofOpacity: 0.4,
    windowScale: 1.2,
    accentTrim: true,
    trimColor: '#3a3f4a',
    slabColor: '#c2c6cb',
    stairColor: '#9aa0a6',
    pitchedRoofColor: '#7d4f2a',
  },
  luxury: {
    wallHeight: 10.5,
    wallColor: '#f8f4ea',
    wallRoughness: 0.6,
    roofType: 'flat',
    roofOverhang: 2,
    roofOpacity: 0.4,
    windowScale: 1.35,
    accentTrim: true,
    trimColor: '#9b7a3a',
    slabColor: '#d8cdb5',
    stairColor: '#a89a78',
    pitchedRoofColor: '#7d4f2a',
  },
};

// =========================================================================
// Constants
// =========================================================================

const WALL_THICKNESS = 0.5; // ft — proper wall thickness, not paper-thin
const DOOR_HEIGHT = 7;
const DOOR_THICKNESS = 0.3;
const DOOR_OPEN_ANGLE = Math.PI / 6; // 30° — slightly ajar
const WINDOW_HEIGHT = 4;
const WINDOW_BOTTOM = 3;
const FLOOR_HEIGHT = 10; // vertical spacing between stacked floors
const SLAB_THICKNESS = 0.4;
const FLOOR_SLAB_THICKNESS = 0.05;
const GROUT_THICKNESS = 0.02;
const GROUT_INSET = 0.08; // how far the grout border peeks out beyond the slab
const PITCH_RATIO = 0.32; // pitched roof apex = footprint width * PITCH_RATIO

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

/** Mix a hex colour toward neutral grey by `amount` (0..1) for floor realism. */
function desaturate(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const gray = (c.r + c.g + c.b) / 3;
  c.r = c.r * (1 - amount) + gray * amount;
  c.g = c.g * (1 - amount) + gray * amount;
  c.b = c.b * (1 - amount) + gray * amount;
  return `#${c.getHexString()}`;
}

/** Lighten a hex colour by `amount` (0..1) toward white. */
function lighten(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.r = c.r + (1 - c.r) * amount;
  c.g = c.g + (1 - c.g) * amount;
  c.b = c.b + (1 - c.b) * amount;
  return `#${c.getHexString()}`;
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
  groutColor: string;
}
interface LabelData {
  position: [number, number, number];
  text: string;
  subtext: string;
  color: string;
}
interface FurnitureRender {
  item: FurnitureItem;
  worldX: number;
  worldZ: number;
  worldY: number;
}
/**
 * A hinged door leaf. The group is placed at the hinge position; the panel
 * is offset by half its width along the local +X (or +Z) axis so the leaf
 * pivots around the hinge edge when the group is rotated around Y.
 */
interface DoorLeafData {
  hinge: [number, number, number];
  panelSize: [number, number, number];
  panelOffset: [number, number, number];
  rotationY: number;
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
  doorPanels: DoorLeafData[];
  stairs: BoxData[];
  labels: LabelData[];
  furniture: FurnitureRender[];
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
  const plotW = layout.plot.width;
  const plotL = layout.plot.length;

  // Decide which floors to render.
  const floorsRendered: number[] = [];
  if (showAllFloors) {
    for (let f = 0; f < layout.floors; f++) floorsRendered.push(f);
  } else {
    const f = Math.max(0, Math.min(floor, Math.max(0, layout.floors - 1)));
    floorsRendered.push(f);
  }
  // Single-floor view always renders at ground level (baseY = 0).
  // Multi-floor view stacks at idx * FLOOR_HEIGHT.
  const floorBaseYs = floorsRendered.map((_, idx) =>
    showAllFloors ? idx * FLOOR_HEIGHT : 0,
  );

  const floorSlabs: SlabData[] = [];
  const interFloorSlabs: SlabData[] = [];
  const walls: BoxData[] = [];
  const trims: BoxData[] = [];
  const windows: BoxData[] = [];
  const doorPanels: DoorLeafData[] = [];
  const stairs: BoxData[] = [];
  const labels: LabelData[] = [];
  const furniture: FurnitureRender[] = [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  floorsRendered.forEach((f, idx) => {
    const baseY = floorBaseYs[idx];
    const floorRooms = layout.rooms.filter((r) => r.floor === f);

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

      // Per-room coloured floor slab — keep colors vivid (less desaturation) for
      // a clean, vibrant architectural look. Slight lightening for brightness.
      const baseColor = isOpenAir ? '#c8c8c8' : catalog?.color ?? '#e8e8e8';
      const slabColor = lighten(desaturate(baseColor, 0.08), 0.05);
      // Grout is a noticeably darker version of the slab colour.
      const groutColor = desaturate(slabColor, 0.5);
      floorSlabs.push({
        position: [cx, baseY + FLOOR_SLAB_THICKNESS / 2, cz],
        size: [room.width, room.length],
        color: slabColor,
        groutColor,
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

      // Walls (skip open-air rooms).
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
        );
      }

      // Staircase steps.
      if (isStaircase) {
        addStairs(room, baseY, plotW, plotL, stairs);
      }

      // Floating label.
      labels.push({
        position: [cx, baseY + wallHeight + 0.6, cz],
        text: room.name,
        subtext: `${room.width.toFixed(1)} \u00D7 ${room.length.toFixed(1)} ft`,
        color: catalog?.accent ?? '#2b4a7a',
      });
    });

    // Inter-floor ceiling slab between this floor and the next.
    if (showAllFloors && idx < floorsRendered.length - 1 && fMinX < Infinity) {
      const slabY = baseY + wallHeight + SLAB_THICKNESS / 2;
      interFloorSlabs.push({
        position: [(fMinX + fMaxX) / 2, slabY, (fMinZ + fMaxZ) / 2],
        size: [fMaxX - fMinX, fMaxZ - fMinZ],
        color: cfg.slabColor,
        groutColor: cfg.slabColor,
      });
    }
  });

  // Furniture — render via <FurnitureMesh3D>.
  const allFurniture: FurnitureItem[] = layout.furniture ?? [];
  if (showFurniture) {
    for (const item of allFurniture) {
      const idx = floorsRendered.indexOf(item.floor);
      if (idx < 0) continue;
      const baseY = floorBaseYs[idx];
      // Furniture sits on top of the floor slab.
      const worldY = baseY + FLOOR_SLAB_THICKNESS + 0.01;
      const worldX = item.x + item.width / 2 - plotW / 2;
      const worldZ = item.y + item.length / 2 - plotL / 2;
      furniture.push({ item, worldX, worldZ, worldY });
    }
  }

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
    labels,
    furniture,
    footprint,
    totalBuildingHeight,
    roofY,
  };
}

// -------------------------------------------------------------------------
// Wall builder — emits thin shell segments around each room perimeter,
// leaving gaps for doors. Windows are translucent glass overlays. Doors
// are hinged leaves rotated 30° ajar.
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
  doorPanels: DoorLeafData[],
  cfg: StyleConfig,
) {
  const wallCenterY = baseY + wallHeight / 2;

  // TOP wall — along X, at z = to3DZ(room.y)
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
  // BOTTOM wall — along X, at z = to3DZ(room.y + room.length)
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
  // LEFT wall — along Z, at x = to3DX(room.x)
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
  // RIGHT wall — along Z, at x = to3DX(room.x + room.width)
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
  doorPanels: DoorLeafData[];
  cfg: StyleConfig;
}

function buildAxisWall(a: AxisWallArgs) {
  const segments = splitWallByOpenings(
    a.length,
    a.doors.map((d) => ({ pos: d.pos, width: d.width })),
  );
  const isX = a.axis === 'x';

  // Solid wall segments (with door gaps).
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

  // Windows — glossy translucent cyan glass overlays on the wall surface.
  for (const win of a.wins) {
    const wWidth = Math.min(win.width * a.cfg.windowScale, a.length * 0.7);
    const center = a.startCoord + win.pos * a.length;
    const winY = a.baseY + WINDOW_BOTTOM + WINDOW_HEIGHT / 2;
    const thick = WALL_THICKNESS * 1.4;
    if (isX) {
      a.windows.push({
        position: [center, winY, a.fixedCoord],
        size: [wWidth, WINDOW_HEIGHT, thick],
      });
    } else {
      a.windows.push({
        position: [a.fixedCoord, winY, center],
        size: [thick, WINDOW_HEIGHT, wWidth],
      });
    }
  }

  // Doors — hinged leaves rotated 30° ajar.
  // Hinge sits at one edge of the door opening (on the wall line); the panel
  // is offset by half its width along local +X (X-wall) or +Z (Z-wall) so it
  // pivots around the hinge when the group is rotated around Y.
  for (const d of a.doors) {
    const center = a.startCoord + d.pos * a.length;
    const leafW = d.width * 0.92;
    if (isX) {
      // Wall runs along X. Hinge at (center - leafW/2, *, fixedCoord).
      const hingeX = center - leafW / 2;
      a.doorPanels.push({
        hinge: [hingeX, a.baseY, a.fixedCoord],
        panelSize: [leafW, DOOR_HEIGHT, DOOR_THICKNESS],
        panelOffset: [leafW / 2, DOOR_HEIGHT / 2, 0],
        rotationY: -DOOR_OPEN_ANGLE,
      });
    } else {
      // Wall runs along Z. Hinge at (fixedCoord, *, center - leafW/2).
      const hingeZ = center - leafW / 2;
      a.doorPanels.push({
        hinge: [a.fixedCoord, a.baseY, hingeZ],
        panelSize: [DOOR_THICKNESS, DOOR_HEIGHT, leafW],
        panelOffset: [0, DOOR_HEIGHT / 2, leafW / 2],
        rotationY: DOOR_OPEN_ANGLE,
      });
    }
  }
}

// -------------------------------------------------------------------------
// Stairs — a flight of ascending steps.
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

// =========================================================================
// React components — Roof, PlotOutline, NorthArrow, RoomLabel, DoorLeaf,
//                     CameraRig
// =========================================================================

interface RoofProps {
  footprint: Footprint;
  roofY: number;
  cfg: StyleConfig;
  accentColor: string;
}

function Roof({
  footprint,
  roofY,
  cfg,
  accentColor,
}: RoofProps): React.JSX.Element {
  const { minX, maxX, minZ, maxZ } = footprint;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const isPitched = cfg.roofType === 'pitched';
  const overhang = cfg.roofOverhang;
  const totalW = w + overhang * 2;
  const totalD = d + overhang * 2;
  const pitchH = totalW * PITCH_RATIO;

  // Triangular-prism ExtrudeGeometry for the pitched roof.
  const geom = useMemo(() => {
    if (!isPitched) return null;
    const shape = new THREE.Shape();
    shape.moveTo(-totalW / 2, 0);
    shape.lineTo(totalW / 2, 0);
    shape.lineTo(0, pitchH);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: totalD,
      bevelEnabled: false,
    });
    g.translate(0, 0, -totalD / 2);
    g.computeVertexNormals();
    return g;
  }, [isPitched, totalW, pitchH, totalD]);

  if (isPitched && geom) {
    return (
      <mesh geometry={geom} position={[cx, roofY, cz]} castShadow receiveShadow>
        <meshStandardMaterial
          color={cfg.pitchedRoofColor}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
    );
  }

  // Flat slab (optionally with overhang) — semi-transparent accent colour.
  return (
    <mesh
      position={[cx, roofY + SLAB_THICKNESS / 2, cz]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[totalW, SLAB_THICKNESS, totalD]} />
      <meshStandardMaterial
        color={accentColor}
        roughness={0.5}
        metalness={0.1}
        transparent
        opacity={cfg.roofOpacity}
        depthWrite={false}
      />
    </mesh>
  );
}

// -------------------------------------------------------------------------
// Plot outline — thin accent-coloured wireframe on the ground.
// -------------------------------------------------------------------------

function PlotOutline({
  plotW,
  plotL,
  accentColor,
}: {
  plotW: number;
  plotL: number;
  accentColor: string;
}): React.JSX.Element {
  const edges = useMemo(() => {
    const geo = new THREE.PlaneGeometry(plotW, plotL);
    geo.rotateX(-Math.PI / 2);
    return new THREE.EdgesGeometry(geo);
  }, [plotW, plotL]);
  return (
    <lineSegments geometry={edges} position={[0, 0.02, 0]}>
      <lineBasicMaterial color={accentColor} linewidth={2} />
    </lineSegments>
  );
}

// -------------------------------------------------------------------------
// North arrow — clean white disc + red cone + "N" text at the plot corner.
// -------------------------------------------------------------------------

function NorthArrow({
  plotW,
  plotL,
  northDir,
}: {
  plotW: number;
  plotL: number;
  northDir: number;
}): React.JSX.Element {
  const x = plotW / 2 + 3.5;
  const z = -plotL / 2 - 3.5;
  const rotY = (-northDir * Math.PI) / 180;
  return (
    <group position={[x, 0, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        receiveShadow
      >
        <circleGeometry args={[1.4, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0} />
      </mesh>
      <group rotation={[0, rotY, 0]}>
        <mesh position={[0, 1, 0]} castShadow>
          <coneGeometry args={[0.45, 1.8, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>
      <Text
        position={[0, 2.5, 0]}
        fontSize={0.85}
        color="#1e3a5f"
        anchorX="center"
        anchorY="middle"
      >
        N
      </Text>
    </group>
  );
}

// -------------------------------------------------------------------------
// DoorLeaf — a hinged panel rotated 30° ajar.
// -------------------------------------------------------------------------

function DoorLeaf({ data }: { data: DoorLeafData }): React.JSX.Element {
  return (
    <group position={data.hinge} rotation={[0, data.rotationY, 0]}>
      <mesh
        position={data.panelOffset}
        castShadow
        receiveShadow
      >
        <boxGeometry args={data.panelSize} />
        <meshStandardMaterial
          color="#8a6a4a"
          roughness={0.6}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------------------
// Room label — clean floating white pill with an accent left border.
// Bold room name + muted mono dimensions subtext.
// -------------------------------------------------------------------------

function RoomLabel({ label }: { label: LabelData }): React.JSX.Element {
  return (
    <Html
      position={label.position}
      center
      distanceFactor={20}
      zIndexRange={[10, 0]}
      pointerEvents="none"
      occlude={false}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.96)',
          padding: '5px 12px 5px 10px',
          borderRadius: 8,
          borderLeft: `4px solid ${label.color}`,
          boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
          color: '#1e293b',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1.15,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label.text}</div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#64748b',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            marginTop: 1,
          }}
        >
          {label.subtext}
        </div>
      </div>
    </Html>
  );
}

// -------------------------------------------------------------------------
// CameraRig — animated camera transitions on cameraView change.
// Cancels animation when the user starts dragging OrbitControls.
// -------------------------------------------------------------------------

type ControlsLike = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

interface CameraRigProps {
  cameraView: 'orbit' | 'top' | 'front' | 'isometric';
  plotW: number;
  plotL: number;
}

function CameraRig({
  cameraView,
  plotW,
  plotL,
}: CameraRigProps): React.JSX.Element | null {
  const cameraTargetRef = useRef(new THREE.Vector3());
  const lookAtRef = useRef(new THREE.Vector3());
  const animatingRef = useRef(true);

  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  // Compute target position + lookAt whenever cameraView changes (per spec).
  useEffect(() => {
    let pos: [number, number, number];
    let look: [number, number, number];
    switch (cameraView) {
      case 'isometric':
        pos = [plotW * 0.6, plotW * 0.75, plotW * 0.6];
        look = [0, 5, 0];
        break;
      case 'front':
        pos = [0, 7, plotL * 1.15];
        look = [0, 5, 0];
        break;
      case 'top':
        pos = [0.01, plotL * 1.6, 0.01];
        look = [0, 0, 0];
        break;
      case 'orbit':
      default:
        pos = [plotW * 0.75, plotW * 0.65, plotW * 0.85];
        look = [0, 5, 0];
        break;
    }
    cameraTargetRef.current.set(pos[0], pos[1], pos[2]);
    lookAtRef.current.set(look[0], look[1], look[2]);
    animatingRef.current = true;
  }, [cameraView, plotW, plotL]);

  // Cancel animation on user interaction with OrbitControls.
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      animatingRef.current = false;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  useFrame(() => {
    if (!animatingRef.current) return;
    camera.position.lerp(cameraTargetRef.current, 0.08);
    if (controls) {
      controls.target.lerp(lookAtRef.current, 0.08);
      controls.update();
    } else {
      camera.lookAt(lookAtRef.current);
    }
    if (camera.position.distanceTo(cameraTargetRef.current) < 0.15) {
      animatingRef.current = false;
    }
  });

  return null;
}

// =========================================================================
// Scene — assembles sky, lights, environment, ground, building, labels,
// controls. This is the heart of the "clean, bright, professional" look.
// =========================================================================

function Scene(props: Viewer3DProps): React.JSX.Element {
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
  const cfg = STYLE_CONFIG[style];

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

  const contactShadowScale = Math.max(plotW, plotL, 20) + 20;

  // Single-floor cutaway → walls are semi-transparent so furniture is
  // clearly visible inside. Multi-floor mode → solid exterior walls.
  const wallOpacity = showAllFloors ? 1 : 0.35;
  const wallTransparent = wallOpacity < 1;

  return (
    <>
      {/* Soft sky-blue background as a fallback / atmospheric base.
          The <Sky> component paints a real atmospheric gradient on top. */}
      <color attach="background" args={['#eaf2fa']} />
      <fog attach="fog" args={['#eaf2fa', 90, 320]} />

      {/* Real atmospheric sky — soft gradient + sun glow. Wrapped in Suspense
          so the rest of the scene can paint immediately. */}
      <Suspense fallback={null}>
        <Sky
          distance={450000}
          sunPosition={[25, 35, 18]}
          inclination={0.5}
          azimuth={0.25}
          turbidity={6}
          rayleigh={1.2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
      </Suspense>

      {/* Lighting rig — BRIGHT and CLEAN.
          Ambient kills dullness; hemisphere adds sky/ground bounce;
          key directional sun casts crisp shadows; fill softens the dark side. */}
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#d8dde6', 0.7]} />
      <directionalLight
        position={[25, 35, 18]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-bias={-0.0001}
      />
      {/* Soft fill from the opposite side (no shadow) — kills flat dark sides. */}
      <directionalLight position={[-20, 25, -12]} intensity={0.5} />

      {/* Image-based lighting for realistic reflections on walls, floors,
          windows, furniture. Wrapped in Suspense so it loads async. */}
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      {/* Animated camera rig */}
      <CameraRig cameraView={cameraView} plotW={plotW} plotL={plotL} />

      {/* Ground plane — clean light concrete, 300×300. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#d4d8de" roughness={0.95} metalness={0} />
      </mesh>

      {/* Subtle infinite grid — clean technical reference. */}
      <Grid
        args={[300, 300]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#c8ccd4"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#a0a8b4"
        fadeDistance={120}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.005, 0]}
      />

      {/* Soft ambient-occlusion grounding shadow under the building. */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={contactShadowScale}
        blur={2.2}
        far={24}
        opacity={0.55}
        resolution={1024}
      />

      {/* Accent-coloured plot boundary wireframe */}
      <PlotOutline plotW={plotW} plotL={plotL} accentColor={accentColor} />

      {/* Building */}
      <group>
        {/* Per-room polished-tile floor slabs with grout borders */}
        {scene.floorSlabs.map((s, i) => (
          <group key={`fs-${i}`}>
            {/* Grout underlay — slightly larger than the slab, peeking out
                around the edge as a thin dark border. */}
            <mesh
              position={[
                s.position[0],
                s.position[1] - FLOOR_SLAB_THICKNESS / 2 + GROUT_THICKNESS / 2,
                s.position[2],
              ]}
              receiveShadow
            >
              <boxGeometry
                args={[
                  s.size[0] + GROUT_INSET * 2,
                  GROUT_THICKNESS,
                  s.size[1] + GROUT_INSET * 2,
                ]}
              />
              <meshStandardMaterial
                color={s.groutColor}
                roughness={0.9}
                metalness={0}
              />
            </mesh>
            {/* Polished tile slab — glossy to catch light and look clean. */}
            <mesh position={s.position} receiveShadow>
              <boxGeometry
                args={[s.size[0], FLOOR_SLAB_THICKNESS, s.size[1]]}
              />
              <meshStandardMaterial
                color={s.color}
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
          </group>
        ))}

        {/* Inter-floor ceiling slabs (multi-floor only) */}
        {scene.interFloorSlabs.map((s, i) => (
          <mesh key={`is-${i}`} position={s.position} receiveShadow castShadow>
            <boxGeometry args={[s.size[0], SLAB_THICKNESS, s.size[1]]} />
            <meshStandardMaterial
              color={s.color}
              roughness={0.85}
              metalness={0}
            />
          </mesh>
        ))}

        {/* Walls — clean white-with-warmth, semi-transparent in cutaway. */}
        {scene.walls.map((w, i) => (
          <mesh
            key={`w-${i}`}
            position={w.position}
            castShadow
            receiveShadow
          >
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color={cfg.wallColor}
              roughness={cfg.wallRoughness}
              metalness={0}
              transparent={wallTransparent}
              opacity={wallOpacity}
              depthWrite={!wallTransparent}
            />
          </mesh>
        ))}

        {/* Accent trims */}
        {scene.trims.map((w, i) => (
          <mesh key={`t-${i}`} position={w.position} castShadow>
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color={cfg.trimColor}
              roughness={0.6}
              metalness={0.1}
            />
          </mesh>
        ))}

        {/* Windows — glossy translucent cyan glass */}
        {scene.windows.map((w, i) => (
          <mesh key={`win-${i}`} position={w.position}>
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color="#a8d8f5"
              transparent
              opacity={0.35}
              roughness={0.05}
              metalness={0.2}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Doors — hinged leaves, slightly ajar */}
        {scene.doorPanels.map((d, i) => (
          <DoorLeaf key={`dp-${i}`} data={d} />
        ))}

        {/* Stairs */}
        {scene.stairs.map((w, i) => (
          <mesh
            key={`st-${i}`}
            position={w.position}
            castShadow
            receiveShadow
          >
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color={cfg.stairColor}
              roughness={0.8}
              metalness={0}
            />
          </mesh>
        ))}

        {/* Furniture — rendered through <FurnitureMesh3D>.
            Cars and bikes are included automatically via the furniture list. */}
        {showFurniture &&
          scene.furniture.map((f, i) => (
            <group
              key={`fur-${f.item.id ?? i}`}
              position={[0, f.worldY, 0]}
            >
              <FurnitureMesh3D
                item={f.item}
                worldX={f.worldX}
                worldZ={f.worldZ}
              />
            </group>
          ))}

        {/* Roof — only when showAllFloors */}
        {showAllFloors && scene.footprint && (
          <Roof
            footprint={scene.footprint}
            roofY={scene.roofY}
            cfg={cfg}
            accentColor={accentColor}
          />
        )}

        {/* Room labels */}
        {showLabels &&
          scene.labels.map((lbl, i) => (
            <RoomLabel key={`lbl-${i}`} label={lbl} />
          ))}
      </group>

      {/* North arrow indicator */}
      <NorthArrow
        plotW={plotW}
        plotL={plotL}
        northDir={layout.plot.northDirection}
      />

      {/* Orbit controls (makeDefault so CameraRig can read state.controls) */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={180}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, 5, 0]}
      />
    </>
  );
}
