# Task 5-c — 3d-car-bike-rebuild

## Task
Rebuild the `CarModel` and `BikeModel` functions in
`src/components/openblueprint/workspace/furniture-3d.tsx` so the 3D viewer
shows a recognizable, animated, realistic sedan/SUV and motorcycle instead of
the previous "blocky" proxies. Lightweight (max ~30 meshes each), subtle
"alive" animation, no other code changes.

## Inputs reviewed
- `worklog.md` (project context, Tasks 1 / 5-a / 5-b / 8).
- `src/components/openblueprint/workspace/furniture-3d.tsx`:
  - Confirmed helper signatures:
    - `Box({ position?, size, color, roughness?, metalness?, opacity?, rotation? })`
    - `Cyl({ position?, rotation?, radiusTop?, radiusBottom?, height, color, roughness?, metalness?, opacity?, radialSegments? })`
    - `Sph({ position?, radius, scale?, color, roughness?, metalness?, opacity? })`
    - `Cone({ position?, radius, height, color, roughness? })`
  - `Box`/`Cyl`/etc. do **not** expose `emissive` — emissive lights (head/tail
    bulbs) must use raw `<mesh>` + `<boxGeometry>`/`<sphereGeometry>` +
    `<meshStandardMaterial emissive=... emissiveIntensity=.../>`. Did so.
  - Confirmed `ModelProps = { w, l, color }`; `w` along X, `l` along Z.
    Default car ~6×10ft, bike ~2.5×6ft.
  - Confirmed existing top-level `darkenHex(hex, amount)` helper is available
    to derive a darker shade of the body color.
  - File is `'use client'` so `useFrame` from `@react-three/fiber` is allowed.
- Task-5-b viewer record — confirmed the viewer passes a `<group position={[0, worldY, 0]}><FurnitureMesh3D …/></group>` wrapper, so model-local origin sits on the floor and +Y is up. Wheels placed at y=wheelRadius sit correctly on the ground.

## Edits made
1. **Imports** (top of `furniture-3d.tsx`):
   - Added `useRef` to the `react` import.
   - Added `import { useFrame } from '@react-three/fiber';`
   - Added `import * as THREE from 'three';`
   (Required by the animation refs and `THREE.Group` type. No other top-of-file changes.)
2. **`CarModel`** — full rewrite. Convention: +Z = front (headlights), -Z = rear (taillights), +X = right.
   - Lower chassis box `[w, 1.5, l*0.92]` at y=1 (full-width, full-length body).
   - Hood box `[w*0.92, 1.1, l*0.2]` at front (+Z) and trunk box of same size at rear (-Z) — give the slightly tapered, "longer lower body" silhouette. All three boxes use metallic paint (`roughness 0.3, metalness 0.6`) with body color; hood/trunk use `darkenHex(body, 0.18)` for subtle two-tone.
   - Raised cabin/roof `[w*0.84, 1.05, l*0.46]` at y=2.35, slightly forward of center (z = +l*0.02).
   - Front & rear windshields: thin (depth 0.06) dark-glass boxes (`#1a2a3a`, `roughness 0.05, metalness 0.3, opacity 0.7`) rotated ±0.5 rad around X so the tops lean toward the cabin center (proper rake).
   - Side windows: thin dark-glass slabs on the cabin sides.
   - Side mirrors: two small chrome boxes (`#9aa0a6, metalness 0.7`) on the cabin sides at the front edge.
   - Front grille: thin dark slab (`#0e0e0e`) at the front face.
   - Headlights: two emissive warm-white `<mesh>` boxes (`color #fff8d0, emissive #ffe08a, emissiveIntensity 0.6`) at the front face.
   - Taillights: two emissive red `<mesh>` boxes (`color #5a1010, emissive #cc2020, emissiveIntensity 0.4`) at the rear face.
   - Wheels: 4 groups at the corners. Each is a dark tire `Cyl(radius 0.55, height 0.5, #1a1a1a, roughness 0.85, radialSegments 22)` rotated `[0,0,π/2]` (axle along X) + a lighter hub `Cyl(radius 0.55*0.55, height 0.52, #888, metalness 0.7)` slightly proud on both sides for a hubcap look.
   - Animation: a wrapping `<group ref={bodyRef}>` carries chassis + cabin + windshields + windows + mirrors + grille + lights. `useFrame` sets `position.y = sin(t*2) * 0.1` (±0.1ft bob) and `rotation.z = sin(t*2 + 0.4) * 0.012` (subtle roll). Wheels are **outside** bodyRef so they stay grounded (suspension look). 23 meshes total — under the 30 limit.
3. **`BikeModel`** — full rewrite. Convention: +Z = front, -Z = rear, +X = right.
   - Main frame: narrow box `[w*0.45, 0.9, l*0.7]` at y=1.1 (color prop, `roughness 0.4, metalness 0.5`).
   - Engine block: darker box `[w*0.5, 0.7, l*0.22]` at y=0.65 under the tank (`#333, roughness 0.6, metalness 0.5`).
   - Fuel tank: raised slightly-wider box `[w*0.5, 0.7, l*0.22]` at y=1.7 (`darkenHex(color, 0.25), metalness 0.6`).
   - Tank curved top: half-buried `Cyl` rotated `[π/2, 0, 0]` (axis along Z) with `radiusTop = radiusBottom = w*0.25` and `height = l*0.22`, centered at y=1.95 so its top hemisphere pokes above the tank box and the bottom half is hidden inside — gives the rounded tank silhouette.
   - Seat: dark leather box `[w*0.4, 0.35, l*0.22]` at y=1.55, behind the tank (`#2a1a0a, roughness 0.7`).
   - Rear fender: thin dark box above the rear wheel.
   - Handlebar: thin cylinder across the front (rotation `[0,0,π/2]`, axle along X) at y=2.15.
   - Handlebar grips: two darker, slightly fatter cylinders at the ends of the bar.
   - Front fork: 2 thin metallic cylinders (`#555, metalness 0.8`) tilted forward via `rotation=[-0.15, 0, 0]` — they visually connect the handlebar area (y≈2.19, z≈1.91) down to the front wheel hub (y≈0.51, z≈2.17) for the typical motorcycle rake.
   - Exhaust pipe: long thin metallic-silver cylinder along the right side (rotation `[π/2, 0, 0]`, `#ccc, metalness 0.9, roughness 0.1`).
   - Exhaust tip: slightly wider brighter cylinder at the rear end of the pipe.
   - Headlight: dark chrome ring housing (`Cyl` axis along Z) + bright emissive sphere (`<mesh>` + `<sphereGeometry>` + `<meshStandardMaterial color #ffe08a, emissive #ffe08a, emissiveIntensity 0.7>`) at the front.
   - Tail light: small emissive red `<mesh>` box at the rear.
   - Wheels: 2 groups, each = dark tire `Cyl(radius 0.55, height 0.15, radialSegments 20)` rotated `[0,0,π/2]` + lighter hub `Cyl(radius 0.275, height 0.17, #888, metalness 0.7)`.
   - Front wheel also carries 2 cross-spokes (`<Box>` in the YZ plane) so its spin animation is visually obvious.
   - Animation: outer `<group ref={bodyRef}>` rolls gently (`rotation.z = sin(t*1.5) * 0.03`). Inner `<group ref={frontWheelRef}>` (nested inside bodyRef, at the front wheel position) spins around its local X axis (`rotation.x = t * 2.5`), which is the wheel's axle. 22 meshes total — under the 30 limit.
4. **TypeScript**: `useRef<THREE.Group>(null)` for both refs; `useFrame((state) => { … })` reads `state.clock.elapsedTime`. Null-guarded with `if (ref.current)`.

## Verification
- `bunx tsc --noEmit 2>&1 | grep furniture-3d` → no output (clean).
- `bunx tsc --noEmit` overall shows only `examples/` and `skills/` errors (out of scope per task spec).
- `bun run lint` → exit 0, no warnings on `furniture-3d.tsx`.
- `dev.log` → `✓ Compiled in …` repeatedly, no errors after the edit; `GET / 200`.

## Stage summary
- Files changed: `src/components/openblueprint/workspace/furniture-3d.tsx` only — added 3 imports, fully rewrote `CarModel` and `BikeModel`. No other functions touched.
- Car (23 meshes): tapered body + raised cabin, slanted front/rear windshields, dark side glass, chrome mirrors, front grille, emissive headlights & taillights, 4 dark tires with lighter hubs at the corners; gentle ±0.1ft vertical bob + subtle roll on `sin(t*2)`; wheels stay grounded (suspension feel).
- Bike (22 meshes): narrow metallic frame, raised fuel tank with curved (half-cylinder) top, dark engine block under tank, leather seat, rear fender, handlebar + grips, 2 tilted metallic front forks, metallic-silver exhaust pipe + tip, emissive spherical headlight with chrome ring housing, emissive red tail light, 2 wheels with hubs + front-wheel cross-spokes; front wheel spins slowly around its axle, body has a subtle ±0.03 rad roll lean.
- Both models remain under the 30-mesh budget, keep the exact `function (Car|Bike)Model({ w, l, color }: ModelProps)` signature, use `castShadow` on emissive and primary meshes, and respect the existing 1-unit-per-foot +Z-front convention so they slot straight into the Task-5-b viewer without any further integration work.
