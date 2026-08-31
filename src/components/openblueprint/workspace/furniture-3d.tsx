'use client';

// =========================================================================
// OpenBlueprint — 3D Furniture Models Library (Task 5-a)
// React Three Fiber component that renders a recognizable 3D model for
// each FurnitureType, built from Three.js primitives (boxes, cylinders,
// spheres, cones, torus).
//
// Coordinate convention (matches viewer-3d.tsx):
//   - 1 unit = 1 foot
//   - Origin at the centre of the plot, +Y is up
//   - The parent viewer passes the ALREADY-CONVERTED world-space centre
//     of the furniture via `worldX` / `worldZ`.
//   - The model is built in local space (centred on origin, sitting on
//     the floor at y=0), then placed by a single parent <group> with
//     position=[worldX, 0, worldZ] and rotation=[0, item.rotation*π/180, 0].
//
// Each model scales to fit `item.width` (local X) × `item.length`
// (local Z). Local +Z is treated as the "back" of the furniture
// (headboard, sofa backrest, chair backrest, etc.).
// =========================================================================

import React, { useMemo } from 'react';
import type { FurnitureItem, FurnitureType } from '@/lib/types';

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export interface FurnitureMesh3DProps {
  item: FurnitureItem;
  /** Already-converted 3D X coordinate (feet, plot-centred). */
  worldX: number;
  /** Already-converted 3D Z coordinate (feet, plot-centred). */
  worldZ: number;
}

export function FurnitureMesh3D(props: FurnitureMesh3DProps): React.JSX.Element {
  const { item, worldX, worldZ } = props;
  const color = item.color || '#9aa0a6';
  const w = Math.max(item.width, 0.5);
  const l = Math.max(item.length, 0.5);

  // Memoize the model subtree so changing position/rotation on the parent
  // group does not rebuild the entire mesh tree.
  const model = useMemo(
    () => buildFurnitureModel(item.type, w, l, color),
    [item.type, w, l, color],
  );

  const rotY = ((item.rotation || 0) * Math.PI) / 180;

  return (
    <group position={[worldX, 0, worldZ]} rotation={[0, rotY, 0]}>
      {model}
    </group>
  );
}

export default FurnitureMesh3D;

// -------------------------------------------------------------------------
// Colour helpers
// -------------------------------------------------------------------------

/** Darken a hex colour by `amount` (0..1). Returns the original on parse error. */
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const f = Math.max(0, 1 - amount);
  r = Math.min(255, Math.round(r * f));
  g = Math.min(255, Math.round(g * f));
  b = Math.min(255, Math.round(b * f));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Lighten a hex colour by `amount` (0..1) toward white. */
function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// -------------------------------------------------------------------------
// Primitive helpers — thin wrappers over R3F meshes so each model reads
// as a tidy declarative scene.
// -------------------------------------------------------------------------

interface BoxProps {
  position?: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  rotation?: [number, number, number];
}

function Box({
  position = [0, 0, 0],
  size,
  color,
  roughness = 0.7,
  metalness = 0,
  opacity = 1,
  rotation,
}: BoxProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

interface CylProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  radiusTop?: number;
  radiusBottom?: number;
  height: number;
  color: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  radialSegments?: number;
}

function Cyl({
  position = [0, 0, 0],
  rotation,
  radiusTop = 0.1,
  radiusBottom = 0.1,
  height,
  color,
  roughness = 0.5,
  metalness = 0.2,
  opacity = 1,
  radialSegments = 16,
}: CylProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry
        args={[radiusTop, radiusBottom, height, radialSegments]}
      />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

interface SphProps {
  position?: [number, number, number];
  radius: number;
  scale?: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
}

function Sph({
  position = [0, 0, 0],
  radius,
  scale,
  color,
  roughness = 0.7,
  metalness = 0,
  opacity = 1,
}: SphProps) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[radius, 18, 18]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

interface ConeProps {
  position?: [number, number, number];
  radius: number;
  height: number;
  color: string;
  roughness?: number;
}

function Cone({
  position = [0, 0, 0],
  radius,
  height,
  color,
  roughness = 0.8,
}: ConeProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <coneGeometry args={[radius, height, 18]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

interface HalfSphProps {
  position?: [number, number, number];
  radius: number;
  scale?: [number, number, number];
  color: string;
  roughness?: number;
}

/** Upper hemisphere (dome). */
function HalfSphere({
  position = [0, 0, 0],
  radius,
  scale,
  color,
  roughness = 0.6,
}: HalfSphProps) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <sphereGeometry
        args={[radius, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]}
      />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

interface TorusProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  radius: number;
  tube: number;
  color: string;
  roughness?: number;
  metalness?: number;
}

function Torus({
  position = [0, 0, 0],
  rotation,
  radius,
  tube,
  color,
  roughness = 0.4,
  metalness = 0.4,
}: TorusProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <torusGeometry args={[radius, tube, 8, 28]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

// -------------------------------------------------------------------------
// Per-type model components
// -------------------------------------------------------------------------

interface ModelProps {
  w: number;
  l: number;
  color: string;
}

// ---- Beds ----------------------------------------------------------------

function BedModel({ w, l, color }: ModelProps) {
  const pillow = '#f4f1ec';
  const head = darken(color, 0.25);
  return (
    <group>
      {/* Base / frame */}
      <Box position={[0, 0.5, 0]} size={[w * 0.95, 1, l * 0.85]} color={darken(color, 0.15)} roughness={0.75} />
      {/* Mattress */}
      <Box position={[0, 1.25, 0]} size={[w * 0.92, 0.5, l * 0.82]} color={lighten(color, 0.15)} roughness={0.85} />
      {/* Duvet line */}
      <Box position={[0, 1.5, -l * 0.18]} size={[w * 0.92, 0.12, l * 0.55]} color={color} roughness={0.85} />
      {/* Headboard */}
      <Box position={[0, 2, l * 0.45]} size={[w * 0.96, 3.6, 0.3]} color={head} roughness={0.7} />
      {/* Pillows */}
      <Box position={[-w * 0.22, 1.62, l * 0.28]} size={[w * 0.3, 0.35, l * 0.18]} color={pillow} roughness={0.9} />
      <Box position={[w * 0.22, 1.62, l * 0.28]} size={[w * 0.3, 0.35, l * 0.18]} color={pillow} roughness={0.9} />
    </group>
  );
}

// ---- Sofas ---------------------------------------------------------------

function SofaModel({ w, l, color }: ModelProps) {
  const cushion = lighten(color, 0.12);
  const frame = darken(color, 0.2);
  return (
    <group>
      {/* Seat base */}
      <Box position={[0, 0.9, 0]} size={[w * 0.96, 1.1, l * 0.85]} color={frame} roughness={0.8} />
      {/* Seat cushions */}
      <Box position={[-w * 0.22, 1.55, -l * 0.02]} size={[w * 0.42, 0.4, l * 0.7]} color={cushion} roughness={0.85} />
      <Box position={[w * 0.22, 1.55, -l * 0.02]} size={[w * 0.42, 0.4, l * 0.7]} color={cushion} roughness={0.85} />
      {/* Backrest */}
      <Box position={[0, 2.4, l * 0.38]} size={[w * 0.96, 1.9, 0.35]} color={color} roughness={0.8} />
      {/* Armrests */}
      <Box position={[-w * 0.46, 1.5, 0]} size={[0.3, 2, l * 0.85]} color={frame} roughness={0.8} />
      <Box position={[w * 0.46, 1.5, 0]} size={[0.3, 2, l * 0.85]} color={frame} roughness={0.8} />
    </group>
  );
}

function SofaLModel({ w, l, color }: ModelProps) {
  const cushion = lighten(color, 0.12);
  const frame = darken(color, 0.2);
  return (
    <group>
      {/* Horizontal arm: full width along X, sits at -Z half */}
      <Box position={[0, 0.9, -l * 0.22]} size={[w * 0.96, 1.1, l * 0.52]} color={frame} roughness={0.8} />
      <Box position={[-w * 0.22, 1.55, -l * 0.22]} size={[w * 0.42, 0.4, l * 0.4]} color={cushion} roughness={0.85} />
      <Box position={[w * 0.22, 1.55, -l * 0.22]} size={[w * 0.42, 0.4, l * 0.4]} color={cushion} roughness={0.85} />
      {/* Vertical arm: right side along Z, sits at +Z half */}
      <Box position={[w * 0.28, 0.9, l * 0.22]} size={[w * 0.38, 1.1, l * 0.52]} color={frame} roughness={0.8} />
      <Box position={[w * 0.28, 1.55, l * 0.22]} size={[w * 0.3, 0.4, l * 0.42]} color={cushion} roughness={0.85} />
      {/* Backrest along -Z edge of horizontal arm */}
      <Box position={[0, 2.4, -l * 0.46]} size={[w * 0.96, 1.9, 0.3]} color={color} roughness={0.8} />
      {/* Backrest along +X edge of vertical arm */}
      <Box position={[w * 0.46, 2.4, l * 0.22]} size={[0.3, 1.9, l * 0.52]} color={color} roughness={0.8} />
    </group>
  );
}

function ArmchairModel({ w, l, color }: ModelProps) {
  const cushion = lighten(color, 0.12);
  const frame = darken(color, 0.2);
  return (
    <group>
      <Box position={[0, 0.9, 0]} size={[w * 0.9, 1.1, l * 0.85]} color={frame} roughness={0.8} />
      <Box position={[0, 1.55, 0]} size={[w * 0.75, 0.4, l * 0.7]} color={cushion} roughness={0.85} />
      <Box position={[0, 2.4, l * 0.38]} size={[w * 0.9, 1.9, 0.3]} color={color} roughness={0.8} />
      <Box position={[-w * 0.42, 1.5, 0]} size={[0.25, 2, l * 0.85]} color={frame} roughness={0.8} />
      <Box position={[w * 0.42, 1.5, 0]} size={[0.25, 2, l * 0.85]} color={frame} roughness={0.8} />
    </group>
  );
}

// ---- Chairs --------------------------------------------------------------

function ChairDiningModel({ w, l, color }: ModelProps) {
  const legColor = darken(color, 0.3);
  const legR = Math.min(w, l) * 0.08;
  return (
    <group>
      {/* Seat */}
      <Box position={[0, 1.5, 0]} size={[w * 0.9, 0.2, l * 0.9]} color={color} roughness={0.7} />
      {/* Backrest */}
      <Box position={[0, 2.4, -l * 0.4]} size={[w * 0.9, 1.8, 0.15]} color={color} roughness={0.7} />
      {/* Legs */}
      <Cyl position={[-w * 0.38, 0.7, -l * 0.38]} radiusTop={legR} radiusBottom={legR} height={1.4} color={legColor} />
      <Cyl position={[w * 0.38, 0.7, -l * 0.38]} radiusTop={legR} radiusBottom={legR} height={1.4} color={legColor} />
      <Cyl position={[-w * 0.38, 0.7, l * 0.38]} radiusTop={legR} radiusBottom={legR} height={1.4} color={legColor} />
      <Cyl position={[w * 0.38, 0.7, l * 0.38]} radiusTop={legR} radiusBottom={legR} height={1.4} color={legColor} />
    </group>
  );
}

function ChairOfficeModel({ w, l, color }: ModelProps) {
  const metal = '#3a3f47';
  const legLen = Math.min(w, l) * 0.85;
  const angles = [0, 72, 144, 216, 288];
  return (
    <group>
      {/* 5-star base: 5 cylinders radiating outward */}
      {angles.map((a, i) => (
        <group key={i} rotation={[0, (a * Math.PI) / 180, 0]}>
          <Cyl
            position={[legLen * 0.4, 0.2, 0]}
            rotation={[0, 0, Math.PI / 2]}
            radiusTop={0.06}
            radiusBottom={0.06}
            height={legLen * 0.8}
            color={metal}
            metalness={0.6}
            roughness={0.3}
          />
        </group>
      ))}
      {/* Central post */}
      <Cyl position={[0, 1.1, 0]} radiusTop={0.12} radiusBottom={0.12} height={1.9} color={metal} metalness={0.6} roughness={0.3} />
      {/* Seat */}
      <Box position={[0, 2.15, 0]} size={[w * 0.85, 0.2, l * 0.85]} color={color} roughness={0.7} />
      {/* Low backrest */}
      <Box position={[0, 2.85, -l * 0.4]} size={[w * 0.7, 1.3, 0.18]} color={color} roughness={0.7} />
    </group>
  );
}

function BarStoolModel({ w, l, color }: ModelProps) {
  const metal = '#2a2d33';
  const seatR = Math.min(w, l) * 0.42;
  return (
    <group>
      {/* Post */}
      <Cyl position={[0, 1.1, 0]} radiusTop={0.08} radiusBottom={0.08} height={2.2} color={metal} metalness={0.7} roughness={0.3} />
      {/* Round seat */}
      <Cyl position={[0, 2.3, 0]} radiusTop={seatR} radiusBottom={seatR} height={0.2} color={color} roughness={0.6} />
      {/* Foot ring */}
      <Torus position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} radius={seatR * 0.55} tube={0.04} color={metal} metalness={0.7} />
      {/* Base foot */}
      <Cyl position={[0, 0.06, 0]} radiusTop={0.25} radiusBottom={0.3} height={0.12} color={metal} metalness={0.7} roughness={0.3} />
    </group>
  );
}

// ---- Tables --------------------------------------------------------------

function TableRoundModel({ w, l, color }: ModelProps) {
  const topR = Math.min(w, l) * 0.46;
  const baseR = Math.min(w, l) * 0.28;
  return (
    <group>
      {/* Base */}
      <Cyl position={[0, 0.15, 0]} radiusTop={baseR} radiusBottom={baseR} height={0.3} color={darken(color, 0.2)} roughness={0.6} />
      {/* Pedestal */}
      <Cyl position={[0, 1.2, 0]} radiusTop={0.14} radiusBottom={0.14} height={1.9} color={darken(color, 0.25)} roughness={0.5} />
      {/* Top */}
      <Cyl position={[0, 2.3, 0]} radiusTop={topR} radiusBottom={topR} height={0.2} color={color} roughness={0.4} />
    </group>
  );
}

function TableRectModel({ w, l, color, height }: ModelProps & { height: number }) {
  const legColor = darken(color, 0.3);
  const legR = Math.min(w, l) * 0.06;
  return (
    <group>
      <Box position={[0, height, 0]} size={[w * 0.96, 0.2, l * 0.96]} color={color} roughness={0.5} />
      <Cyl position={[-w * 0.4, height / 2, -l * 0.4]} radiusTop={legR} radiusBottom={legR} height={height} color={legColor} />
      <Cyl position={[w * 0.4, height / 2, -l * 0.4]} radiusTop={legR} radiusBottom={legR} height={height} color={legColor} />
      <Cyl position={[-w * 0.4, height / 2, l * 0.4]} radiusTop={legR} radiusBottom={legR} height={height} color={legColor} />
      <Cyl position={[w * 0.4, height / 2, l * 0.4]} radiusTop={legR} radiusBottom={legR} height={height} color={legColor} />
    </group>
  );
}

function DeskModel({ w, l, color }: ModelProps) {
  const legColor = darken(color, 0.3);
  const legR = Math.min(w, l) * 0.05;
  const H = 2.5;
  return (
    <group>
      <Box position={[0, H, 0]} size={[w * 0.96, 0.2, l * 0.96]} color={color} roughness={0.5} />
      {/* Three legs + a drawer pedestal on one side */}
      <Cyl position={[-w * 0.4, H / 2, -l * 0.4]} radiusTop={legR} radiusBottom={legR} height={H} color={legColor} />
      <Cyl position={[-w * 0.4, H / 2, l * 0.4]} radiusTop={legR} radiusBottom={legR} height={H} color={legColor} />
      <Cyl position={[w * 0.4, H / 2, -l * 0.4]} radiusTop={legR} radiusBottom={legR} height={H} color={legColor} />
      {/* Drawer pedestal */}
      <Box position={[w * 0.3, H / 2, l * 0.0]} size={[w * 0.32, H, l * 0.8]} color={darken(color, 0.1)} roughness={0.6} />
      {/* Drawer lines */}
      <Box position={[w * 0.3, H * 0.7, l * 0.41]} size={[w * 0.28, 0.04, 0.02]} color={darken(color, 0.4)} />
      <Box position={[w * 0.3, H * 0.45, l * 0.41]} size={[w * 0.28, 0.04, 0.02]} color={darken(color, 0.4)} />
    </group>
  );
}

// ---- Storage / Wardrobes -------------------------------------------------

function WardrobeModel({ w, l, color }: ModelProps) {
  const body = darken(color, 0.05);
  const shelf = darken(color, 0.25);
  const H = 7;
  return (
    <group>
      <Box position={[0, H / 2, 0]} size={[w * 0.96, H, l * 0.95]} color={body} roughness={0.65} />
      {/* Two door seams on the front (+Z face) */}
      <Box position={[0, H / 2, l * 0.485]} size={[0.04, H * 0.92, 0.03]} color={shelf} />
      <Box position={[-w * 0.24, H / 2, l * 0.485]} size={[0.02, H * 0.92, 0.02]} color={shelf} />
      <Box position={[w * 0.24, H / 2, l * 0.485]} size={[0.02, H * 0.92, 0.02]} color={shelf} />
      {/* Door handles */}
      <Cyl position={[-w * 0.04, H / 2, l * 0.5]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.03} radiusBottom={0.03} height={0.3} color={shelf} metalness={0.6} />
      <Cyl position={[w * 0.04, H / 2, l * 0.5]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.03} radiusBottom={0.03} height={0.3} color={shelf} metalness={0.6} />
      {/* Internal shelves visible from top */}
      <Box position={[0, H * 0.33, 0]} size={[w * 0.9, 0.08, l * 0.88]} color={shelf} />
      <Box position={[0, H * 0.66, 0]} size={[w * 0.9, 0.08, l * 0.88]} color={shelf} />
    </group>
  );
}

function ShelfModel({ w, l, color }: ModelProps) {
  const shelf = darken(color, 0.25);
  const H = 6.5;
  return (
    <group>
      {/* Side panels + back */}
      <Box position={[0, H / 2, 0]} size={[w * 0.96, H, l * 0.9]} color={color} roughness={0.65} />
      {/* Open front: 4 horizontal shelves recessed */}
      {[H * 0.15, H * 0.38, H * 0.61, H * 0.84].map((y, i) => (
        <Box key={i} position={[0, y, l * 0.05]} size={[w * 0.9, 0.08, l * 0.78]} color={shelf} roughness={0.6} />
      ))}
      {/* Vertical partitions */}
      <Box position={[0, H / 2, l * 0.05]} size={[0.08, H * 0.9, l * 0.78]} color={shelf} roughness={0.6} />
    </group>
  );
}

function DisplayShelfModel({ w, l, color }: ModelProps) {
  const shelf = darken(color, 0.25);
  const H = 5;
  return (
    <group>
      <Box position={[0, H / 2, 0]} size={[w * 0.96, H, l * 0.85]} color={color} roughness={0.65} />
      {[H * 0.2, H * 0.5, H * 0.8].map((y, i) => (
        <Box key={i} position={[0, y, l * 0.05]} size={[w * 0.9, 0.08, l * 0.72]} color={shelf} roughness={0.6} />
      ))}
      {/* Vertical divider */}
      <Box position={[0, H / 2, l * 0.05]} size={[0.08, H * 0.92, l * 0.72]} color={shelf} roughness={0.6} />
    </group>
  );
}

// ---- TV ------------------------------------------------------------------

function TvUnitModel({ w, l, color }: ModelProps) {
  const H = 1.5;
  return (
    <group>
      <Box position={[0, H / 2, 0]} size={[w * 0.96, H, l * 0.9]} color={color} roughness={0.65} />
      {/* Door seams */}
      <Box position={[0, H / 2, l * 0.46]} size={[0.03, H * 0.8, 0.02]} color={darken(color, 0.35)} />
      <Box position={[-w * 0.22, H / 2, l * 0.46]} size={[0.02, H * 0.8, 0.02]} color={darken(color, 0.35)} />
      <Box position={[w * 0.22, H / 2, l * 0.46]} size={[0.02, H * 0.8, 0.02]} color={darken(color, 0.35)} />
    </group>
  );
}

function TvWallModel({ w, l, color }: ModelProps) {
  const screen = '#0a0a0a';
  const frame = '#1a1a1a';
  return (
    <group>
      {/* Stand base */}
      <Box position={[0, 0.1, 0]} size={[w * 0.5, 0.2, l * 1.5]} color={frame} roughness={0.4} metalness={0.4} />
      {/* Stand neck */}
      <Box position={[0, 1, 0]} size={[0.25, 1.8, 0.25]} color={frame} roughness={0.4} metalness={0.4} />
      {/* Screen */}
      <Box position={[0, 3.7, 0]} size={[w * 0.95, 0.15, l * 1.6]} color={screen} roughness={0.2} metalness={0.6} />
      {/* Screen glow */}
      <Box position={[0, 3.7, l * 0.7]} size={[w * 0.85, 0.05, l * 1.2]} color={'#1a2630'} roughness={0.3} metalness={0.5} opacity={0.6} />
    </group>
  );
}

// ---- Kitchen -------------------------------------------------------------

function CounterModel({ w, l, color }: ModelProps) {
  const top = darken(color, 0.1);
  return (
    <group>
      <Box position={[0, 1.4, 0]} size={[w * 0.96, 2.8, l * 0.95]} color={color} roughness={0.6} />
      <Box position={[0, 2.95, 0]} size={[w, 0.2, l]} color={top} roughness={0.4} />
      {/* Door lines on front */}
      {Array.from({ length: Math.max(2, Math.floor(w / 2)) }).map((_, i, arr) => {
        const x = -w * 0.4 + (i / Math.max(1, arr.length - 1)) * w * 0.8;
        return <Box key={i} position={[x, 1.5, l * 0.485]} size={[0.03, 2.4, 0.02]} color={darken(color, 0.35)} />;
      })}
    </group>
  );
}

function KitchenIslandModel({ w, l, color }: ModelProps) {
  const top = darken(color, 0.1);
  return (
    <group>
      <Box position={[0, 1.4, 0]} size={[w * 0.9, 2.8, l * 0.9]} color={color} roughness={0.6} />
      {/* Countertop with overhang */}
      <Box position={[0, 2.9, 0]} size={[w * 1.05, 0.2, l * 1.05]} color={top} roughness={0.4} />
      {/* Stool-side overhang detail */}
      <Box position={[0, 2.7, l * 0.5]} size={[w * 0.8, 0.08, 0.15]} color={darken(top, 0.15)} roughness={0.5} />
    </group>
  );
}

function StoveModel({ w, l, color }: ModelProps) {
  const top = '#1a1a1a';
  const burner = '#3a3a3a';
  return (
    <group>
      <Box position={[0, 1.4, 0]} size={[w * 0.95, 2.8, l * 0.95]} color={color} roughness={0.5} metalness={0.3} />
      <Box position={[0, 2.9, 0]} size={[w * 0.95, 0.1, l * 0.95]} color={top} roughness={0.3} metalness={0.5} />
      {/* 4 burners */}
      <Cyl position={[-w * 0.22, 2.96, -l * 0.22]} radiusTop={w * 0.1} radiusBottom={w * 0.1} height={0.08} color={burner} metalness={0.6} roughness={0.3} />
      <Cyl position={[w * 0.22, 2.96, -l * 0.22]} radiusTop={w * 0.1} radiusBottom={w * 0.1} height={0.08} color={burner} metalness={0.6} roughness={0.3} />
      <Cyl position={[-w * 0.22, 2.96, l * 0.22]} radiusTop={w * 0.1} radiusBottom={w * 0.1} height={0.08} color={burner} metalness={0.6} roughness={0.3} />
      <Cyl position={[w * 0.22, 2.96, l * 0.22]} radiusTop={w * 0.1} radiusBottom={w * 0.1} height={0.08} color={burner} metalness={0.6} roughness={0.3} />
      {/* Control knobs */}
      <Cyl position={[-w * 0.3, 2.7, l * 0.5]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.05} radiusBottom={0.05} height={0.05} color={'#888'} metalness={0.7} />
      <Cyl position={[w * 0.3, 2.7, l * 0.5]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.05} radiusBottom={0.05} height={0.05} color={'#888'} metalness={0.7} />
    </group>
  );
}

function SinkKitchenModel({ w, l, color }: ModelProps) {
  const basin = '#c0cad6';
  const metal = '#9aa3ad';
  return (
    <group>
      <Box position={[0, 1.4, 0]} size={[w * 0.95, 2.8, l * 0.95]} color={color} roughness={0.5} />
      <Box position={[0, 2.9, 0]} size={[w * 0.95, 0.12, l * 0.95]} color={darken(color, 0.15)} roughness={0.4} />
      {/* Recessed basin */}
      <Box position={[0, 2.85, 0]} size={[w * 0.65, 0.18, l * 0.65]} color={basin} roughness={0.3} metalness={0.4} />
      {/* Faucet */}
      <Cyl position={[-w * 0.25, 3.25, -l * 0.3]} radiusTop={0.05} radiusBottom={0.05} height={0.8} color={metal} metalness={0.8} roughness={0.2} />
      <Cyl position={[-w * 0.25, 3.65, -l * 0.1]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.05} radiusBottom={0.05} height={l * 0.35} color={metal} metalness={0.8} roughness={0.2} />
    </group>
  );
}

function FridgeModel({ w, l, color }: ModelProps) {
  const H = 6;
  const line = darken(color, 0.3);
  return (
    <group>
      <Box position={[0, H / 2, 0]} size={[w * 0.95, H, l * 0.95]} color={color} roughness={0.4} metalness={0.3} />
      {/* Door split (freezer divider) */}
      <Box position={[0, H * 0.7, l * 0.485]} size={[w * 0.92, 0.04, 0.03]} color={line} />
      {/* Vertical door seams */}
      <Box position={[0, H / 2, l * 0.485]} size={[0.03, H * 0.95, 0.02]} color={line} />
      {/* Handles */}
      <Cyl position={[w * 0.4, H * 0.85, l * 0.5]} radiusTop={0.04} radiusBottom={0.04} height={0.6} color={line} metalness={0.7} />
      <Cyl position={[w * 0.4, H * 0.4, l * 0.5]} radiusTop={0.04} radiusBottom={0.04} height={1.0} color={line} metalness={0.7} />
    </group>
  );
}

// ---- Bathroom ------------------------------------------------------------

function ToiletModel({ w, l, color }: ModelProps) {
  const seat = '#e8e8e8';
  return (
    <group>
      {/* Tank */}
      <Box position={[0, 1.5, l * 0.28]} size={[w * 0.85, 2.4, l * 0.28]} color={color} roughness={0.4} />
      {/* Bowl — ellipsoid */}
      <Sph position={[0, 0.6, -l * 0.12]} radius={Math.min(w, l) * 0.4} scale={[1, 0.7, 1.1]} color={color} roughness={0.4} />
      {/* Seat (thin flat ring on top of bowl) */}
      <Cyl position={[0, 1.05, -l * 0.12]} radiusTop={Math.min(w, l) * 0.36} radiusBottom={Math.min(w, l) * 0.36} height={0.1} color={seat} roughness={0.5} />
      <Cyl position={[0, 1.1, -l * 0.12]} radiusTop={Math.min(w, l) * 0.22} radiusBottom={Math.min(w, l) * 0.22} height={0.12} color={darken(seat, 0.1)} roughness={0.5} />
    </group>
  );
}

function BathtubModel({ w, l, color }: ModelProps) {
  const water = '#cfe2f0';
  return (
    <group>
      <Box position={[0, 0.7, 0]} size={[w * 0.96, 1.4, l * 0.96]} color={color} roughness={0.35} metalness={0.2} />
      {/* Recessed interior */}
      <Box position={[0, 1.05, 0]} size={[w * 0.78, 0.5, l * 0.78]} color={water} roughness={0.2} metalness={0.1} opacity={0.85} />
      {/* Faucet at one end */}
      <Cyl position={[-w * 0.4, 1.4, 0]} radiusTop={0.05} radiusBottom={0.05} height={0.5} color={'#9aa3ad'} metalness={0.8} roughness={0.2} />
      <Cyl position={[-w * 0.32, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} radiusTop={0.04} radiusBottom={0.04} height={0.2} color={'#9aa3ad'} metalness={0.8} roughness={0.2} />
    </group>
  );
}

function ShowerModel({ w, l, color }: ModelProps) {
  const glass = '#bcd6e6';
  const H = 6.5;
  return (
    <group>
      {/* Base */}
      <Box position={[0, 0.05, 0]} size={[w * 0.96, 0.1, l * 0.96]} color={color} roughness={0.5} />
      {/* Curb */}
      <Box position={[0, 0.2, l * 0.48]} size={[w * 0.96, 0.3, 0.15]} color={darken(color, 0.15)} roughness={0.5} />
      {/* Two glass walls (along -X and -Z) */}
      <Box position={[-w * 0.48, H / 2 + 0.2, 0]} size={[0.08, H, l * 0.96]} color={glass} roughness={0.1} metalness={0.1} opacity={0.2} />
      <Box position={[0, H / 2 + 0.2, -l * 0.48]} size={[w * 0.96, H, 0.08]} color={glass} roughness={0.1} metalness={0.1} opacity={0.2} />
      {/* Shower head at the corner */}
      <Cyl position={[-w * 0.4, H - 0.5, -l * 0.4]} radiusTop={0.1} radiusBottom={0.12} height={0.3} color={'#9aa3ad'} metalness={0.7} roughness={0.3} />
      <Cyl position={[-w * 0.4, H - 0.3, -l * 0.4]} rotation={[0, 0, 0]} radiusTop={0.04} radiusBottom={0.04} height={0.5} color={'#9aa3ad'} metalness={0.7} roughness={0.3} />
    </group>
  );
}

function VanityModel({ w, l, color }: ModelProps) {
  const basin = '#dde6ed';
  const metal = '#9aa3ad';
  return (
    <group>
      <Box position={[0, 1.4, 0]} size={[w * 0.95, 2.8, l * 0.9]} color={color} roughness={0.55} />
      <Box position={[0, 2.9, 0]} size={[w * 1, 0.12, l * 0.95]} color={darken(color, 0.1)} roughness={0.35} />
      {/* Recessed basin */}
      <Box position={[0, 2.92, 0]} size={[w * 0.45, 0.18, l * 0.55]} color={basin} roughness={0.25} metalness={0.2} />
      {/* Faucet */}
      <Cyl position={[0, 3.3, -l * 0.25]} radiusTop={0.05} radiusBottom={0.05} height={0.8} color={metal} metalness={0.8} roughness={0.2} />
      <Cyl position={[0, 3.7, -l * 0.05]} rotation={[Math.PI / 2, 0, 0]} radiusTop={0.04} radiusBottom={0.04} height={l * 0.3} color={metal} metalness={0.8} roughness={0.2} />
      {/* Drawer line */}
      <Box position={[0, 1.6, l * 0.46]} size={[w * 0.85, 0.04, 0.02]} color={darken(color, 0.3)} />
    </group>
  );
}

function WasherModel({ w, l, color }: ModelProps) {
  const door = '#2a2f36';
  const H = 3;
  return (
    <group>
      <Box position={[0, H / 2, 0]} size={[w * 0.95, H, l * 0.95]} color={color} roughness={0.4} metalness={0.3} />
      {/* Round door on +Z face — cylinder rotated to face +Z */}
      <Cyl position={[0, H * 0.55, l * 0.5]} rotation={[Math.PI / 2, 0, 0]} radiusTop={Math.min(w, l) * 0.3} radiusBottom={Math.min(w, l) * 0.3} height={0.1} color={door} roughness={0.2} metalness={0.5} />
      <Cyl position={[0, H * 0.55, l * 0.52]} rotation={[Math.PI / 2, 0, 0]} radiusTop={Math.min(w, l) * 0.22} radiusBottom={Math.min(w, l) * 0.22} height={0.05} color={'#6a727a'} roughness={0.3} metalness={0.6} />
      {/* Control panel */}
      <Box position={[0, H * 0.85, l * 0.48]} size={[w * 0.7, 0.3, 0.04]} color={darken(color, 0.25)} roughness={0.4} metalness={0.4} />
    </group>
  );
}

// ---- Plants --------------------------------------------------------------

function PlantModel({ w, l, color, large }: ModelProps & { large?: boolean }) {
  const potColor = '#a7613a';
  const foliage = color;
  const potH = large ? 1.1 : 0.7;
  const potR = Math.min(w, l) * (large ? 0.35 : 0.3);
  return (
    <group>
      {/* Pot */}
      <Cyl position={[0, potH / 2, 0]} radiusTop={potR} radiusBottom={potR * 0.85} height={potH} color={potColor} roughness={0.8} />
      {/* Soil */}
      <Cyl position={[0, potH - 0.02, 0]} radiusTop={potR * 0.95} radiusBottom={potR * 0.95} height={0.06} color={'#3a2a1a'} roughness={1} />
      {/* Foliage — cluster of spheres */}
      {large ? (
        <>
          <Sph position={[0, potH + 1.2, 0]} radius={potR * 1.4} scale={[1, 1.1, 1]} color={foliage} roughness={0.9} />
          <Sph position={[-potR * 0.8, potH + 0.9, potR * 0.4]} radius={potR * 0.9} color={lighten(foliage, 0.1)} roughness={0.9} />
          <Sph position={[potR * 0.7, potH + 1.5, -potR * 0.3]} radius={potR * 0.85} color={darken(foliage, 0.1)} roughness={0.9} />
          <Sph position={[0, potH + 2.2, 0]} radius={potR * 0.7} color={lighten(foliage, 0.05)} roughness={0.9} />
        </>
      ) : (
        <>
          <Sph position={[0, potH + 0.7, 0]} radius={potR * 1.1} color={foliage} roughness={0.9} />
          <Sph position={[-potR * 0.4, potH + 0.5, potR * 0.3]} radius={potR * 0.6} color={lighten(foliage, 0.1)} roughness={0.9} />
          <Sph position={[potR * 0.4, potH + 0.9, -potR * 0.2]} radius={potR * 0.55} color={darken(foliage, 0.1)} roughness={0.9} />
        </>
      )}
    </group>
  );
}

// ---- Decor ---------------------------------------------------------------

function RugModel({ w, l, color }: ModelProps) {
  return (
    <group>
      <Box position={[0, 0.025, 0]} size={[w * 0.96, 0.05, l * 0.96]} color={color} roughness={0.95} opacity={0.75} />
      {/* Inner border */}
      <Box position={[0, 0.04, 0]} size={[w * 0.78, 0.02, l * 0.78]} color={lighten(color, 0.15)} roughness={0.95} opacity={0.75} />
    </group>
  );
}

function LampFloorModel({ w, l, color }: ModelProps) {
  const metal = '#3a3a3a';
  return (
    <group>
      {/* Base */}
      <Cyl position={[0, 0.1, 0]} radiusTop={0.35} radiusBottom={0.4} height={0.2} color={metal} metalness={0.6} roughness={0.3} />
      {/* Post */}
      <Cyl position={[0, 2.5, 0]} radiusTop={0.05} radiusBottom={0.05} height={4.8} color={metal} metalness={0.6} roughness={0.3} />
      {/* Shade — truncated cone */}
      <Cone position={[0, 5.1, 0]} radius={0.55} height={1.0} color={color} roughness={0.8} />
    </group>
  );
}

function PoojaAltarModel({ w, l, color }: ModelProps) {
  const accent = '#d4a574';
  const domeColor = '#c08a55';
  return (
    <group>
      {/* Cabinet */}
      <Box position={[0, 1, 0]} size={[w * 0.95, 2, l * 0.95]} color={color} roughness={0.6} />
      {/* Door panel */}
      <Box position={[0, 1, l * 0.475]} size={[w * 0.78, 1.7, 0.04]} color={darken(color, 0.15)} roughness={0.6} />
      <Box position={[0, 1, l * 0.49]} size={[0.03, 1.7, 0.02]} color={accent} roughness={0.5} />
      {/* Step */}
      <Box position={[0, 0.15, l * 0.6]} size={[w * 0.8, 0.3, 0.4]} color={darken(color, 0.2)} roughness={0.6} />
      {/* Dome on top */}
      <HalfSphere position={[0, 2.05, 0]} radius={Math.min(w, l) * 0.25} color={domeColor} roughness={0.5} />
      {/* Finial */}
      <Cyl position={[0, 2.6, 0]} radiusTop={0.03} radiusBottom={0.06} height={0.3} color={accent} metalness={0.6} roughness={0.4} />
    </group>
  );
}

// ---- Composite sets ------------------------------------------------------

function DiningSetModel({ w, l, color, chairs }: ModelProps & { chairs: 4 | 6 }) {
  const tableW = w * 0.6;
  const tableL = l * 0.5;
  const chairColor = darken(color, 0.45);
  // Chair layout: chairs/2 along each long side (and 1 on each short side if 6)
  const layout: Array<[number, number, number]> = [];
  if (chairs === 4) {
    layout.push([-w * 0.15, 0, -l * 0.4]);
    layout.push([w * 0.15, 0, -l * 0.4]);
    layout.push([-w * 0.15, 0, l * 0.4]);
    layout.push([w * 0.15, 0, l * 0.4]);
  } else {
    layout.push([-w * 0.22, 0, -l * 0.4]);
    layout.push([0, 0, -l * 0.4]);
    layout.push([w * 0.22, 0, -l * 0.4]);
    layout.push([-w * 0.22, 0, l * 0.4]);
    layout.push([0, 0, l * 0.4]);
    layout.push([w * 0.22, 0, l * 0.4]);
  }
  return (
    <group>
      {/* Table (rect, dining height) */}
      <TableRectModel w={tableW} l={tableL} color={color} height={2.5} />
      {/* Chairs (rotated to face the table) */}
      {layout.map(([cx, cy, cz], i) => {
        const isTop = cz < 0;
        return (
          <group key={i} position={[cx, cy, cz]} rotation={[0, isTop ? Math.PI : 0, 0]}>
            <ChairDiningModel w={Math.min(w, l) * 0.22} l={Math.min(w, l) * 0.22} color={chairColor} />
          </group>
        );
      })}
    </group>
  );
}

function OfficeCabinModel({ w, l, color }: ModelProps) {
  const deskColor = darken(color, 0.1);
  const chairColor = '#2a2d33';
  const partition = darken(color, 0.2);
  return (
    <group>
      {/* Desk along the back (-Z) */}
      <group position={[0, 0, -l * 0.28]}>
        <DeskModel w={w * 0.7} l={l * 0.32} color={deskColor} />
      </group>
      {/* Office chair */}
      <group position={[0, 0, -l * 0.05]}>
        <ChairOfficeModel w={Math.min(w, l) * 0.28} l={Math.min(w, l) * 0.28} color={chairColor} />
      </group>
      {/* Partition wall behind desk */}
      <Box position={[0, 2.5, -l * 0.46]} size={[w * 0.9, 5, 0.2]} color={partition} roughness={0.7} />
      {/* Bookshelf on the side */}
      <group position={[-w * 0.4, 0, l * 0.2]}>
        <ShelfModel w={w * 0.18} l={l * 0.5} color={deskColor} />
      </group>
    </group>
  );
}

function ClothingRackModel({ w, l, color }: ModelProps) {
  const metal = darken(color, 0.1);
  const garment1 = '#6a7a90';
  const garment2 = '#9b6a6a';
  const garment3 = '#7a8a6a';
  const postH = 5;
  return (
    <group>
      {/* Two vertical posts */}
      <Cyl position={[-w * 0.4, postH / 2, 0]} radiusTop={0.08} radiusBottom={0.08} height={postH} color={metal} metalness={0.6} roughness={0.3} />
      <Cyl position={[w * 0.4, postH / 2, 0]} radiusTop={0.08} radiusBottom={0.08} height={postH} color={metal} metalness={0.6} roughness={0.3} />
      {/* Horizontal bar — cylinder rotated to lie along X */}
      <Cyl position={[0, postH - 0.2, 0]} rotation={[0, 0, Math.PI / 2]} radiusTop={0.06} radiusBottom={0.06} height={w * 0.8} color={metal} metalness={0.6} roughness={0.3} />
      {/* Base feet */}
      <Box position={[-w * 0.4, 0.05, 0]} size={[0.4, 0.1, l * 0.6]} color={metal} metalness={0.6} roughness={0.3} />
      <Box position={[w * 0.4, 0.05, 0]} size={[0.4, 0.1, l * 0.6]} color={metal} metalness={0.6} roughness={0.3} />
      {/* Hanging garments */}
      {[-w * 0.22, 0, w * 0.22].map((gx, i) => {
        const gColor = [garment1, garment2, garment3][i];
        return (
          <group key={i} position={[gx, 0, 0]}>
            {/* Hanger triangle (suggested by a thin box) */}
            <Box position={[0, postH - 0.7, 0]} size={[0.4, 0.04, 0.04]} color={metal} metalness={0.6} />
            {/* Garment body */}
            <Box position={[0, postH - 2, 0]} size={[0.5, 2.4, 0.25]} color={gColor} roughness={0.85} />
          </group>
        );
      })}
    </group>
  );
}

function MeetingTableModel({ w, l, color }: ModelProps) {
  // Same as a large rectangular table at dining height.
  return <TableRectModel w={w} l={l} color={color} height={2.5} />;
}

// ---- Default fallback ----------------------------------------------------

function DefaultBoxModel({ w, l, color }: ModelProps) {
  return (
    <group>
      <Box position={[0, 0.75, 0]} size={[w * 0.9, 1.5, l * 0.9]} color={color} />
    </group>
  );
}

// -------------------------------------------------------------------------
// Dispatcher — picks the right model for a FurnitureType.
// -------------------------------------------------------------------------

function buildFurnitureModel(
  type: FurnitureType,
  w: number,
  l: number,
  color: string,
): React.ReactNode {
  switch (type) {
    case 'bed-single':
    case 'bed-double':
    case 'bed-king':
      return <BedModel w={w} l={l} color={color} />;
    case 'sofa-2':
    case 'sofa-3':
      return <SofaModel w={w} l={l} color={color} />;
    case 'sofa-l':
      return <SofaLModel w={w} l={l} color={color} />;
    case 'armchair':
      return <ArmchairModel w={w} l={l} color={color} />;
    case 'chair-dining':
      return <ChairDiningModel w={w} l={l} color={color} />;
    case 'chair-office':
      return <ChairOfficeModel w={w} l={l} color={color} />;
    case 'bar-stool':
      return <BarStoolModel w={w} l={l} color={color} />;
    case 'table-round':
      return <TableRoundModel w={w} l={l} color={color} />;
    case 'table-rect':
      return <TableRectModel w={w} l={l} color={color} height={2.5} />;
    case 'table-coffee':
      return <TableRectModel w={w} l={l} color={color} height={1.5} />;
    case 'table-dining-6':
      return <TableRectModel w={w} l={l} color={color} height={2.5} />;
    case 'meeting-table':
      return <MeetingTableModel w={w} l={l} color={color} />;
    case 'desk':
      return <DeskModel w={w} l={l} color={color} />;
    case 'wardrobe':
      return <WardrobeModel w={w} l={l} color={color} />;
    case 'bookshelf':
    case 'shelf-wall':
      return <ShelfModel w={w} l={l} color={color} />;
    case 'display-shelf':
      return <DisplayShelfModel w={w} l={l} color={color} />;
    case 'tv-unit':
      return <TvUnitModel w={w} l={l} color={color} />;
    case 'tv-wall':
      return <TvWallModel w={w} l={l} color={color} />;
    case 'kitchen-counter':
    case 'service-counter':
    case 'reception-desk':
      return <CounterModel w={w} l={l} color={color} />;
    case 'kitchen-island':
      return <KitchenIslandModel w={w} l={l} color={color} />;
    case 'stove':
      return <StoveModel w={w} l={l} color={color} />;
    case 'sink-kitchen':
      return <SinkKitchenModel w={w} l={l} color={color} />;
    case 'fridge':
      return <FridgeModel w={w} l={l} color={color} />;
    case 'toilet':
      return <ToiletModel w={w} l={l} color={color} />;
    case 'bathtub':
      return <BathtubModel w={w} l={l} color={color} />;
    case 'shower':
      return <ShowerModel w={w} l={l} color={color} />;
    case 'vanity':
      return <VanityModel w={w} l={l} color={color} />;
    case 'washer':
      return <WasherModel w={w} l={l} color={color} />;
    case 'plant-small':
      return <PlantModel w={w} l={l} color={color} />;
    case 'plant-large':
      return <PlantModel w={w} l={l} color={color} large />;
    case 'rug':
      return <RugModel w={w} l={l} color={color} />;
    case 'lamp-floor':
      return <LampFloorModel w={w} l={l} color={color} />;
    case 'pooja-altar':
      return <PoojaAltarModel w={w} l={l} color={color} />;
    case 'dining-set-4':
      return <DiningSetModel w={w} l={l} color={color} chairs={4} />;
    case 'dining-set-6':
      return <DiningSetModel w={w} l={l} color={color} chairs={6} />;
    case 'office-cabin':
      return <OfficeCabinModel w={w} l={l} color={color} />;
    case 'clothing-rack':
      return <ClothingRackModel w={w} l={l} color={color} />;
    default:
      return <DefaultBoxModel w={w} l={l} color={color} />;
  }
}
