'use client';

// =========================================================================
// OpenBlueprint — 3D Viewer (Task 5-b rebuild)
// React Three Fiber + @react-three/drei visualization of a LayoutData model.
//
// Premium-quality scene:
//   • ACES Filmic tone mapping, antialiased, DPR up to 2
//   • Image-based lighting via drei <Environment preset="apartment">
//   • Ambient + hemisphere + key directional sun + soft fill directional
//   • ContactShadows for ambient occlusion grounding
//   • Subtle infinite <Grid> that fades with distance
//   • Thin-shell walls (~0.5ft) with real door gaps + translucent windows
//   • Per-room desaturated floor slabs
//   • Multi-floor stacking with inter-floor ceiling slabs + roof
//   • Realistic flat / overhang / pitched roofs per design style
//   • Furniture rendered through <FurnitureMesh3D>
//   • Floating HTML room labels
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
  const plotL = layout.plot.length;
  // Initial camera roughly at the orbit preset so first paint matches the rig.
  const initialCam: [number, number, number] = [
    plotW * 0.8,
    plotL * 0.7,
    plotW * 0.9,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        preserveDrawingBuffer: true,
      }}
      camera={{ position: initialCam, fov: 45, near: 0.1, far: 1000 }}
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
    wallColor: '#eceae4',
    wallRoughness: 0.85,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.35,
    windowScale: 1.0,
    accentTrim: false,
    trimColor: '#2b4a7a',
    slabColor: '#cfd5da',
    stairColor: '#a8aeb4',
    pitchedRoofColor: '#7d5a3a',
  },
  minimal: {
    wallHeight: 8.5,
    wallColor: '#f2f0ec',
    wallRoughness: 0.9,
    roofType: 'flat',
    roofOverhang: 0,
    roofOpacity: 0.32,
    windowScale: 0.9,
    accentTrim: false,
    trimColor: '#525252',
    slabColor: '#c8cace',
    stairColor: '#9ca0a4',
    pitchedRoofColor: '#7d5a3a',
  },
  traditional: {
    wallHeight: 9.5,
    wallColor: '#d9cdb8',
    wallRoughness: 0.85,
    roofType: 'pitched',
    roofOverhang: 1.5,
    roofOpacity: 0.85,
    windowScale: 0.85,
    accentTrim: true,
    trimColor: '#6b4423',
    slabColor: '#cab7a0',
    stairColor: '#a08a6e',
    pitchedRoofColor: '#7d4f2a',
  },
  contemporary: {
    wallHeight: 10,
    wallColor: '#e4e0d8',
    wallRoughness: 0.7,
    roofType: 'overhang',
    roofOverhang: 3,
    roofOpacity: 0.32,
    windowScale: 1.25,
    accentTrim: true,
    trimColor: '#3a3f4a',
    slabColor: '#c2c6cb',
    stairColor: '#9aa0a6',
    pitchedRoofColor: '#7d5a3a',
  },
  luxury: {
    wallHeight: 10.5,
    wallColor: '#efeae0',
    wallRoughness: 0.55,
    roofType: 'flat',
    roofOverhang: 2,
    roofOpacity: 0.32,
    windowScale: 1.45,
    accentTrim: true,
    trimColor: '#9b7a3a',
    slabColor: '#d8cdb5',
    stairColor: '#a89a78',
    pitchedRoofColor: '#7d5a3a',
  },
};

// =========================================================================
// Constants
// =========================================================================

const WALL_THICKNESS = 0.5; // ft — proper wall thickness, not paper-thin
const DOOR_HEIGHT = 7;
const WINDOW_HEIGHT = 4;
const WINDOW_BOTTOM = 3;
const FLOOR_HEIGHT = 10; // vertical spacing between stacked floors
const SLAB_THICKNESS = 0.4;
const FLOOR_SLAB_THICKNESS = 0.05;
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
interface FurnitureRender {
  item: FurnitureItem;
  worldX: number;
  worldZ: number;
  worldY: number;
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
  const doorPanels: BoxData[] = [];
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

      // Per-room coloured floor slab (slightly desaturated for realism).
      const baseColor = isOpenAir ? '#cfcfcf' : catalog?.color ?? '#e8e8e8';
      const slabColor = desaturate(baseColor, 0.18);
      floorSlabs.push({
        position: [cx, baseY + FLOOR_SLAB_THICKNESS / 2, cz],
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
// leaving gaps for doors. Windows are translucent cyan overlays.
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
  doorPanels: BoxData[];
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

  // Windows — translucent cyan overlays on the wall surface.
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

  // Door panels — thin leaf at the door position.
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
// React components — Roof, PlotOutline, NorthArrow, RoomLabel, CameraRig
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
      />
    </mesh>
  );
}

// -------------------------------------------------------------------------
// Plot outline — thin wireframe on the ground showing the plot boundary.
// -------------------------------------------------------------------------

function PlotOutline({
  plotW,
  plotL,
}: {
  plotW: number;
  plotL: number;
}): React.JSX.Element {
  const edges = useMemo(() => {
    const geo = new THREE.PlaneGeometry(plotW, plotL);
    geo.rotateX(-Math.PI / 2);
    return new THREE.EdgesGeometry(geo);
  }, [plotW, plotL]);
  return (
    <lineSegments geometry={edges} position={[0, 0.02, 0]}>
      <lineBasicMaterial color="#475569" />
    </lineSegments>
  );
}

// -------------------------------------------------------------------------
// North arrow — disc + cone + "N" text at the plot corner.
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
// Room label — floating HTML pill above each room centre.
// -------------------------------------------------------------------------

function RoomLabel({ label }: { label: LabelData }): React.JSX.Element {
  return (
    <Html
      position={label.position}
      center
      distanceFactor={18}
      zIndexRange={[10, 0]}
      occlude={false}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '4px 10px',
          borderRadius: 12,
          border: `1.5px solid ${label.color}`,
          color: '#1e3a5f',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(15,23,42,0.18)',
          textAlign: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div>{label.text}</div>
        <div
          style={{
            fontSize: 9,
            color: '#6b7280',
            fontWeight: 500,
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

  // Compute target position + lookAt whenever cameraView changes.
  useEffect(() => {
    let pos: [number, number, number];
    let look: [number, number, number];
    switch (cameraView) {
      case 'isometric':
        pos = [plotW * 0.7, plotW * 0.8, plotW * 0.7];
        look = [0, 4, 0];
        break;
      case 'front':
        pos = [0, 6, plotL * 1.1];
        look = [0, 5, 0];
        break;
      case 'top':
        pos = [0, plotL * 1.5, 0.01];
        look = [0, 0, 0];
        break;
      case 'orbit':
      default:
        pos = [plotW * 0.8, plotL * 0.7, plotW * 0.9];
        look = [0, 4, 0];
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
// Scene — assembles lights, environment, ground, building, labels, controls
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

  return (
    <>
      {/* Sky + atmospheric fog */}
      <color attach="background" args={['#e8eef5']} />
      <fog attach="fog" args={['#e8eef5', 70, 240]} />

      {/* Lighting — soft and architectural */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#b0b8c0', 0.6]} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0001}
      />
      {/* Soft fill from the opposite side (no shadow) */}
      <directionalLight position={[-15, 20, -10]} intensity={0.3} />

      {/* Image-based lighting for realistic material reflections */}
      <Suspense fallback={null}>
        <Environment preset="apartment" />
      </Suspense>

      {/* Animated camera rig */}
      <CameraRig cameraView={cameraView} plotW={plotW} plotL={plotL} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#c8cdd4" roughness={0.9} metalness={0} />
      </mesh>

      {/* Subtle infinite grid */}
      <Grid
        args={[200, 200]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#a8aeb6"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#6b7280"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid
        position={[0, 0.005, 0]}
      />

      {/* Soft ambient-occlusion grounding shadow */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={contactShadowScale}
        blur={2}
        far={20}
        opacity={0.5}
        resolution={1024}
      />

      {/* Plot boundary wireframe */}
      <PlotOutline plotW={plotW} plotL={plotL} />

      {/* Building */}
      <group>
        {/* Per-room floor slabs */}
        {scene.floorSlabs.map((s, i) => (
          <mesh
            key={`fs-${i}`}
            position={s.position}
            receiveShadow
          >
            <boxGeometry args={[s.size[0], FLOOR_SLAB_THICKNESS, s.size[1]]} />
            <meshStandardMaterial
              color={s.color}
              roughness={0.6}
              metalness={0}
            />
          </mesh>
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

        {/* Walls */}
        {scene.walls.map((w, i) => {
          // In single-floor cutaway view, make walls semi-transparent so furniture is visible.
          // In showAllFloors mode, walls are solid (realistic exterior).
          const wallOpacity = showAllFloors ? 1 : 0.25;
          return (
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
              transparent={wallOpacity < 1}
              opacity={wallOpacity}
              depthWrite={wallOpacity === 1}
            />
          </mesh>
          );
        })}

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

        {/* Windows — translucent cyan glass */}
        {scene.windows.map((w, i) => (
          <mesh key={`win-${i}`} position={w.position}>
            <boxGeometry args={w.size} />
            <meshStandardMaterial
              color="#7ec8ff"
              transparent
              opacity={0.3}
              roughness={0.1}
              metalness={0}
            />
          </mesh>
        ))}

        {/* Door panels */}
        {scene.doorPanels.map((w, i) => (
          <mesh key={`dp-${i}`} position={w.position} castShadow>
            <boxGeometry args={w.size} />
            <meshStandardMaterial color="#8a6a4a" roughness={0.7} metalness={0} />
          </mesh>
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

        {/* Furniture — rendered through <FurnitureMesh3D> */}
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
        minDistance={5}
        maxDistance={150}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 5, 0]}
      />
    </>
  );
}
