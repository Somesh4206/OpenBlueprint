# Task 8 — 3D Viewer Builder

**Task ID:** 8
**Agent:** 3d-viewer-builder
**Task:** Build 3D house visualization with React Three Fiber

## Deliverable
Created `src/components/openblueprint/workspace/viewer-3d.tsx` — a single-file client component exporting the named `Viewer3D` (and a default export) for use by the workspace view.

## Files Created
- `src/components/openblueprint/workspace/viewer-3d.tsx` (~1380 lines)

## Key Decisions

### Coordinate System
- 1 unit = 1 foot throughout the scene (plot, walls, furniture all in ft).
- Origin at the plot centre, +Y up.
- Conversion: `x3d = room.x + room.width/2 - plot.width/2`, `z3d = room.y + room.length/2 - plot.length/2` (matches the task spec exactly).
- Wall height defaults to 9 ft (8 for minimal, 10.5 for luxury).

### Architecture
- `Viewer3D` (exported, wraps everything in `<Canvas>`) → `<Suspense>` → `Scene` (lights, ground, grid, controls) → `Building` (slabs, walls, windows, doors, stairs, furniture, roof, labels).
- `computeScene(...)` is a pure function wrapped in `useMemo` that turns `LayoutData` + style flags into a flat list of `BoxData`/`SlabData`/`LabelData` objects. Components just render meshes from those lists, so the geometry never recomputes inside `useFrame`.
- A `STYLE_CONFIG` table maps each `DesignStyle` to wall height/color/roughness, roof type & overhang & opacity, window tint/scale, accent trim, slab/stair/furniture colors.

### Walls (thin shells, not solid blocks)
- For each room and each of its 4 walls, `splitWallByOpenings(...)` clamps/merges door intervals and emits the surviving solid segments. Each segment is a 0.3-ft-thick box positioned on the wall line, leaving precise gaps for doors.
- Windows are translucent overlays on the wall surface (no geometry cut), scaled by style.
- Door panels are thin boxes at door position (7-ft-tall leaf).
- Open-air rooms (parking, balcony) get no walls.

### Roof
- `Roof` component handles three cases driven by `STYLE_CONFIG.roofType`:
  - `flat`: thin slab sized to building footprint.
  - `overhang`: same slab but enlarged by the style's `roofOverhang`.
  - `pitched`: an `ExtrudeGeometry` of a triangle, translated to centre on Z, normals recomputed — used only for the `traditional` style.
- All roofs use the `accentColor` prop and are semi-transparent (per-style opacity) so the interior remains visible.

### Multi-floor
- When `showAllFloors` is true, every floor index in `layout.floors` is rendered at `f * (wallHeight + slabThickness)`. A thin ceiling slab (`cfg.slabColor`) is inserted between consecutive floors. The roof sits on top.
- When false, only the requested `floor` (clamped to valid range) is rendered.

### Camera & Controls
- `<OrbitControls makeDefault enableDamping>` provides rotate/zoom/pan.
- `CameraRig` listens for `cameraView` changes and computes a target camera position + lookAt for each preset (orbit / top / front / isometric). It lerps both `camera.position` and `controls.target` over ~75 frames (~1.25 s @ 60 fps) via `useFrame`, calling `controls.update()` each frame so OrbitControls stays in sync.
- Animation auto-cancels when the user starts dragging (listens to OrbitControls `'start'` event) so manual orbit isn't fought.

### Style Variations (concrete effects)
| Style | Wall H | Wall Color | Roof | Overhang | Win Scale | Trim |
|-------|--------|------------|------|----------|-----------|------|
| modern | 9 | #eceff2 | flat | 0 | 1.25 | off |
| minimal | 8 | #d6d8db | flat | 0 | 1.00 | off |
| traditional | 9 | #d8c4a8 | pitched | 1.5 | 0.90 | on (brown) |
| contemporary | 9 | #cfd3d8 | overhang | 3 | 1.45 | on (slate) |
| luxury | 10.5 | #ece4d4 | flat | 2 | 1.55 | on (gold) |

### Extras
- North arrow: white disc + navy cone arrow rotated to `plot.northDirection` (0°=up=−Z in 3D), with a `<Text>` "N" label at the arrow tip.
- Plot outline: thin wireframe rectangle on the ground (EdgesGeometry of the plot footprint).
- Building bounding box: faint wireframe around the building volume.
- Floating room labels: drei `<Html>` with `distanceFactor`, white card with `ROOM_CATALOG[type].accent` border, room name + WxL ft subtext. Toggled by `showLabels`.
- Furniture: per-room-type box proxies (bed+wardrobe, sofa+coffee table+TV, dining table+4 chairs, kitchen counter+island, desk+chair, bath fixtures, altar, console, shelves). Toggled by `showFurniture`.
- Staircase rooms: 7-step ascending flight centred in the room.
- ContactShadows under the building; hemisphere + ambient + shadowed directional + accent point light for soft architectural lighting.

### Robustness
- Empty `layout.rooms` → renders just the plot plane + grid + outline + north arrow (no crash).
- Out-of-range `floor` is clamped to `[0, layout.floors - 1]`.
- `'use client'` directive at top so it can be `dynamic(..., { ssr: false })`-imported by the parent workspace.
- Return type annotated `React.JSX.Element` (React 19 types moved `JSX` under the React namespace; global `JSX.Element` is no longer available).

## Verification
- `bunx tsc --noEmit` — **zero errors in `viewer-3d.tsx`** (only pre-existing noise in `examples/`, `skills/`, and `src/components/openblueprint/mini-plan.tsx` — none of which are this task's responsibility).
- `bun run lint` — exit 0, clean.
- `curl http://localhost:3000/` — HTTP 200, homepage still serving (the parent workspace is still the Task-1 stub; this file is not yet imported by any route — the Task 7+ workspace agent will dynamically import it).
- One iteration needed: initial `anchorX="middle"` on the `<Text>` was rejected by drei's types → switched to `anchorX="center"` (the valid enum value).

## What the Parent Workspace Needs to Do
```tsx
import dynamic from 'next/dynamic';
const Viewer3D = dynamic(
  () => import('./viewer-3d').then((m) => m.Viewer3D),
  { ssr: false },
);
```
Then render `<Viewer3D layout={layout} floor={0} showAllFloors={false} accentColor="#2b4a7a" style="modern" showWalls showFurniture showLabels cameraView="orbit" />`.
