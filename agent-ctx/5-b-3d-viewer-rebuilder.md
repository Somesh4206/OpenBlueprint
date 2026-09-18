# Task 5-b — 3d-viewer-rebuilder

## Task
Rebuild the OpenBlueprint 3D viewer (`src/components/openblueprint/workspace/viewer-3d.tsx`) so it looks professional and realistic instead of "very bad". Integrate the new `<FurnitureMesh3D>` from Task 5-a. Keep the public `Viewer3D(props: Viewer3DProps)` signature exactly, plus a default export.

## Work log
- Read `worklog.md`, the existing Task-8 viewer-3d.tsx, the new Task-5-a furniture-3d.tsx, `src/lib/types.ts`, and `src/lib/room-catalog.ts` to ground the rewrite in the real data model (`LayoutData.furniture: FurnitureItem[]`, `RoomRect.doors/windows`, `PlotConfig.northDirection`, R3F v9 + drei v10 + three v0.185, React 19 `React.JSX.Element`).
- Verified the parent workspace (`workspace.tsx:78`) imports the viewer via `dynamic(() => import('./viewer-3d').then(m => m.Viewer3D), { ssr:false })` and passes the documented props — so the public signature MUST stay identical.
- Completely rewrote `src/components/openblueprint/workspace/viewer-3d.tsx` (~960 lines, single-file client component, named + default export).
- Replaced the old flat-lit scene with a premium-quality setup:
  - `<Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }} camera={{ position, fov: 45, near: 0.1, far: 1000 }}>` per spec.
  - Background `<color args={['#e8eef5']>` + `<fog args={['#e8eef5', 70, 240]}>` for soft atmospheric depth.
  - Lighting rig: `<ambientLight intensity={0.5}>`, `<hemisphereLight args={['#ffffff', '#b0b8c0', 0.6]}>`, key `<directionalLight position={[20,30,15]} intensity={1.2} castShadow shadow-mapSize={[2048,2048]} shadow-camera-*=±40 near=0.5 far=100 shadow-bias=-0.0001>` + fill `<directionalLight position={[-15,20,-10]} intensity={0.3}>`.
  - drei `<Environment preset="apartment">` wrapped in its own `<Suspense fallback={null}>` so IBL reflections load asynchronously without blocking the rest of the scene.
  - 200×200 ground plane (`color #c8cdd4, roughness 0.9`).
  - drei `<Grid cellSize=2 sectionSize=10 fadeDistance=80 infiniteGrid>` for a technical grid that fades with distance.
  - drei `<ContactShadows scale={max(plotW,plotL)+20} blur=2 far=20 opacity=0.5 resolution=1024>` for soft ambient-occlusion grounding.
  - Thin `<PlotOutline>` (EdgesGeometry of a rotated PlaneGeometry) on the ground + `<NorthArrow>` (white disc + red cone + "N" text) at the plot corner, rotated by `plot.northDirection`.
- Walls: kept the proven thin-shell builder (splitWallByOpenings) but bumped WALL_THICKNESS from 0.3 → 0.5 ft so walls have real thickness. Walls are built as boxes around each room perimeter with gaps where doors are marked. Per-style wall colour/roughness/height (modern `#eceae4`/9ft, minimal `#f2f0ec`/8.5ft, traditional `#d9cdb8`/9.5ft pitched, contemporary `#e4e0d8`/10ft overhang, luxury `#efeae0`/10.5ft).
- Floor slabs: thin (0.05ft) per-room coloured slabs using `ROOM_CATALOG[type].color` run through a `desaturate(hex, 0.18)` helper for muted realism.
- Windows: thin translucent cyan boxes (`#7ec8ff, opacity 0.3, roughness 0.1, metalness 0`), height 4ft, sill at 3ft — per spec.
- Doors: gap (via splitWallByOpenings) + thin warm-brown door panel leaf.
- Stairs: 7 ascending step boxes for staircase rooms (kept from old impl).
- Roof: only when `showAllFloors`. Flat (modern/minimal/luxury) and overhang (contemporary) render as semi-transparent accent-coloured slabs (opacity per style). Pitched (traditional) renders as a triangular-prism ExtrudeGeometry in a warm `#7d4f2a` colour. Roof footprint = union of all rendered rooms' bounds + style overhang.
- Multi-floor stacking: each rendered floor at `idx * FLOOR_HEIGHT` (10ft), thin inter-floor ceiling slab between consecutive floors, roof on top of the last floor.
- Single-floor view: only the requested floor is rendered at baseY=0, no roof (cutaway).
- Furniture integration: imported `FurnitureMesh3D` from `./furniture-3d`. For every `layout.furniture` item whose floor is in the rendered set, computed `worldX = item.x + item.width/2 - plotW/2`, `worldZ = item.y + item.length/2 - plotL/2`, `worldY = floorBaseY + slab thickness`, and rendered `<group position={[0, worldY, 0]}><FurnitureMesh3D item={item} worldX={...} worldZ={...} /></group>`. The FurnitureMesh3D handles its own rotation/position in its local space.
- Room labels: drei `<Html center distanceFactor={18}>` floating pills — white bg, navy text, room-type accent border, name + `W × L ft` subtext. Positioned at room centre + wall height + 0.6ft. Only when `showLabels`.
- CameraRig: lerps `camera.position` toward a target vector and `controls.target` toward a lookAt vector on each `cameraView` change. Four presets exactly per spec:
  - `orbit`: `[plotW*0.8, plotL*0.7, plotW*0.9]` lookAt `[0,4,0]`
  - `isometric`: `[plotW*0.7, plotW*0.8, plotW*0.7]` lookAt `[0,4,0]`
  - `front`: `[0, 6, plotL*1.1]` lookAt `[0,5,0]`
  - `top`: `[0, plotL*1.5, 0.01]` lookAt `[0,0,0]`
  - Lerp factor 0.08; cancels when the user starts dragging (listens to `controls.addEventListener('start', …)`). Stops when within 0.15ft of target.
- `<OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={5} maxDistance={150} maxPolarAngle={π/2 - 0.05} target={[0,5,0]}>` — `makeDefault` lets CameraRig read `useThree(s => s.controls)`.
- All geometry derived via `useMemo` keyed on `[layout, floor, showAllFloors, style, showWalls, showFurniture]`. Pitched-roof ExtrudeGeometry and plot EdgesGeometry also memoized.
- Verified: `bunx tsc --noEmit` → 0 errors in viewer-3d.tsx or furniture-3d.tsx (after fixing one return-type: `CameraRig` returns `null`, so its return type is `React.JSX.Element | null`). `bun run lint` exit 0. Dev server compiles cleanly (latest `✓ Compiled in 276ms`, HTTP 200 on `/`).

## Stage summary
- Files changed: `src/components/openblueprint/workspace/viewer-3d.tsx` (full rewrite, ~960 lines, single-file, no new deps required — `Environment`, `Grid`, `ContactShadows`, `Html`, `Text`, `OrbitControls` all already exported by `@react-three/drei` v10).
- Key visual upgrades vs old viewer:
  1. ACES Filmic tone mapping + DPR up to 2 → cinematic, crisp rendering.
  2. `<Environment preset="apartment">` IBL → realistic material reflections on walls, floors, furniture (the single biggest upgrade).
  3. Key + fill directional lights (was just key) → no more harsh dark sides.
  4. Walls thickened 0.3 → 0.5 ft → real architectural shell feel.
  5. Floor colours desaturated 18% → reads like real flooring instead of cartoon swatches.
  6. Translucent cyan windows at proper sill height (was generic tinted overlays).
  7. Per-style wall palettes/heights/roof types now exactly match the spec.
  8. Real furniture via `<FurnitureMesh3D>` (was single-box proxies) — recognizable beds, sofas, tables, kitchen counters, bath fixtures, plants etc.
  9. Smooth animated camera transitions between orbit/iso/front/top — animation cancels on user drag.
  10. ContactShadows + infinite fading Grid + plot wireframe + north arrow for proper grounding and orientation context.
- Public API unchanged — parent workspace's dynamic import + JSX call site need no edits.
- Coordinate convention preserved: 1 unit = 1 ft, origin at plot centre, +Y up, `worldX = item.x + item.width/2 - plotW/2`, `worldZ = item.y + item.length/2 - plotL/2`. Multi-floor stacking uses `worldY = floorIndex * 10`.
- Robustness: empty rooms/furniture render just the plot + grid + outline + north arrow (no crash); out-of-range floor clamped; `layout.furniture ?? []` defensive.
