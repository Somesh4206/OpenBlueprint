# Agent Context — Task 5-a (furniture-3d-builder)

## Task
Build a 3D furniture models library for OpenBlueprint: a single file
`src/components/openblueprint/workspace/furniture-3d.tsx` exporting a React
Three Fiber component `FurnitureMesh3D` that renders a recognizable 3D model
for every `FurnitureType` in the catalog.

## Inputs read
- `/home/z/my-project/worklog.md` — full project history; key reference is
  Task 8 (3d-viewer-builder) which established the 3D conventions.
- `/home/z/my-project/src/lib/types.ts` — `FurnitureType` union (45 values)
  + `FurnitureItem` interface (id, type, name, x, y, width, length,
  rotation, floor, color).
- `/home/z/my-project/src/lib/furniture-catalog.ts` — 45 entries with
  default colours, dimensions, and categories. Used to confirm coverage.
- `/home/z/my-project/src/components/openblueprint/workspace/viewer-3d.tsx`
  (lines 1-60, 640-786) — confirmed conventions:
  - 1 unit = 1 ft, origin at plot centre, +Y up.
  - `'use client'`, React 19 types → `React.JSX.Element` return.
  - Existing single-box furniture proxies in `addFurniture(...)` that this
    new component is meant to replace.

## Files created
- `src/components/openblueprint/workspace/furniture-3d.tsx` (~700 lines)

## Key decisions
1. **Props**: `{ item, worldX, worldZ }` exactly as the task spec required.
   The parent viewer is responsible for converting `item.x`/`item.y` from
   top-left plot coords to plot-centred 3D world coords.
2. **Coordinate system**: each model is built in local space (centred on
   origin, sitting on floor at y=0, local +X = width axis, local +Z =
   "back" of the furniture for headboards/backrests). A single parent
   `<group position={[worldX, 0, worldZ]} rotation={[0, item.rotation*π/180, 0]}>`
   applies world placement and Y-axis rotation.
3. **Primitives**: thin wrapper components `Box`, `Cyl`, `Sph`, `Cone`,
   `HalfSphere`, `Torus` for declarative scene composition. Each wrapper
   sets `castShadow`/`receiveShadow` and `meshStandardMaterial` with
   roughness/metalness tuned per material family.
4. **Colour derivation**: `darken(hex, amount)` and `lighten(hex, amount)`
   helpers generate secondary tones (headboard darker than mattress,
   cushions lighter than sofa frame, etc.) from `item.color || '#9aa0a6'`.
5. **Memoization**: `useMemo(() => buildFurnitureModel(type, w, l, color),
   [type, w, l, color])` builds the model subtree once per prop change so
   parent re-renders (camera/controls) don't rebuild the mesh tree.
6. **Per-type models** — every FurnitureType has a dedicated component:
   - Beds (single/double/king), sofas (2/3/L), armchair
   - Dining chair, office chair (5-star base), bar stool (torus foot ring)
   - Round table, rect table (parametric height for coffee vs dining),
     desk with drawer pedestal, meeting table
   - Wardrobe (door seams + handles), bookshelf/shelf-wall, display-shelf
   - TV unit (low cabinet), TV wall (stand + screen)
   - Kitchen counter/service-counter/reception-desk, kitchen island,
     stove (4 burners + knobs), sink (recessed basin + faucet), fridge
   - Toilet (ellipsoid bowl + tank), bathtub (recessed water interior),
     shower (2 transparent glass walls), vanity, washer (round door)
   - Plants (small/large with clustered sphere foliage)
   - Rug (thin transparent flat box), floor lamp (cone shade), pooja altar
     (cabinet + half-sphere dome + finial)
   - Composite: dining-set-4/6 (table + chairs arranged around),
     office-cabin (desk + chair + partition + shelf), clothing-rack
     (2 posts + bar + hanging garments)
7. **Fallback**: a `DefaultBoxModel` renders a single short box for any
   unknown FurnitureType so the component never crashes.
8. **Exports**: `FurnitureMesh3D` is exported both as named and as default.

## Verification
- `bunx tsc --noEmit 2>&1 | grep "furniture-3d"` → no output (zero errors
  in the new file). Full tsc run also clean outside examples/skills noise.
- `bun run lint` → exit 0, no warnings.
- `tail dev.log` → server still serving HTTP 200 on `/`, no compile
  regressions after creating the file.

## Next-step handoff
The file is ready to be consumed by `viewer-3d.tsx`. The Task 8 viewer
currently renders furniture as single boxes via `addFurniture(...)` and the
`scene.furniture.map((f, i) => <mesh>...</mesh>)` loop around line 998. A
follow-up task (5-b or similar) should:
1. Convert each `FurnitureItem` in `layout.furniture` (filtered by floor)
   to plot-centred 3D world coords: `worldX = item.x + item.width/2 -
   plotW/2`, `worldZ = item.y + item.length/2 - plotL/2`.
2. Replace the box-proxy loop with
   `<FurnitureMesh3D key={item.id} item={item} worldX={...} worldZ={...} />`.
3. Remove or gate the legacy `addFurniture(...)` calls.
