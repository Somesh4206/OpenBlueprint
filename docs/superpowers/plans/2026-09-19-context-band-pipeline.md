# Context-Band Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the context-band pipeline so generated plans obey bands, size caps, and invariants with zero hard fixture failures.

**Architecture:** One new stage (normalizer) plus constraints threaded through band assignment, packing targets, and validator checks. Deterministic throughout; tests use `bun test` (built into bun, no new dependency).

**Tech Stack:** TypeScript, Next.js repo, `bun test` for unit/fixture tests, eslint, `bun x tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-09-19-context-band-pipeline-design.md`

## Global Constraints

- Units are feet; convert only at render time.
- Same input gives the same plan — no `Math.random`, seed jitter only from content hashes.
- Rule priority: hard rules > adjacency > user preference > Vastu > strategy flavour.
- Caps live in config, no magic numbers in code.
- Repair loop stays max 3 retries.
- Area conservation tolerance: warning outside 2%, error above 5%.
- Every change on this track is logged in `worklog.md`.

---

## File structure

- Create `src/lib/architecture/normalize.ts` — pure function `normalizeRequirements(reqs): { reqs, assumptions }`. Single responsibility: guarantee foyer/dining/lobby presence.
- Modify `src/lib/room-catalog.ts` — add `maxArea` + `maxAspect` to `RoomCatalogEntry` and each entry, values verbatim from the spec table.
- Modify `src/lib/architecture/planner.ts` — add `BAND_MAP` config plus `assignBands()`; `packRect` itself is untouched.
- Modify `src/lib/layout/engine.ts` — call normalizer, call `assignBands`, clamp pack targets to caps, cap the absorber at max, remove `TYPE_MAX_INFLATION` reliance (delete the block), wire normalized reqs into `buildPlanningContext` parity.
- Modify `src/lib/layout/validation.ts` — add cap errors (area/aspect) and invariant checks (reachability BFS, door presence, external-window rule, area conservation).
- Modify `src/lib/layout/doors.ts` — tag windows placed on non-external walls so the validator can distinguish them.
- Create `scripts/layout-fixtures.test.ts` — `bun test` fixtures (30×40 2-floor, 20×30 1-floor, 40×60 3-floor × 4 road sides) asserting zero hard failures.

---

### Task 1: Size caps in config + hard validator errors

**Files:**
- Modify: `src/lib/room-catalog.ts:3-18` (interface + 4 entries: bedroom, bathroom, kitchen, living)
- Modify: `src/lib/layout/validation.ts` (dimension section, after the `DIMENSION_TOO_SMALL` check)
- Test: `scripts/caps.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RoomCatalogEntry.maxArea: number`, `RoomCatalogEntry.maxAspect: number`; validation codes `ABOVE_MAX_AREA`, `ABOVE_MAX_ASPECT` (severity `error`).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/caps.test.ts
import { describe, expect, test } from 'bun:test';
import { ROOM_CATALOG } from '../src/lib/room-catalog';

describe('caps config', () => {
  test('bedroom cap is 180 sqft / 1.6 aspect', () => {
    expect(ROOM_CATALOG.bedroom.maxArea).toBe(180);
    expect(ROOM_CATALOG.bedroom.maxAspect).toBe(1.6);
  });
  test('bathroom cap is 80 sqft / 2.0 aspect', () => {
    expect(ROOM_CATALOG.bathroom.maxArea).toBe(80);
    expect(ROOM_CATALOG.bathroom.maxAspect).toBe(2.0);
  });
  test('kitchen cap is 150 sqft / 1.6 aspect', () => {
    expect(ROOM_CATALOG.kitchen.maxArea).toBe(150);
    expect(ROOM_CATALOG.kitchen.maxAspect).toBe(1.6);
  });
  test('living cap is 260 sqft / 1.8 aspect', () => {
    expect(ROOM_CATALOG.living.maxArea).toBe(260);
    expect(ROOM_CATALOG.living.maxAspect).toBe(1.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/caps.test.ts`
Expected: FAIL with `maxArea` undefined (property does not exist).

- [ ] **Step 3: Add caps to the catalog**

```ts
export interface RoomCatalogEntry {
  type: RoomType;
  label: string;
  defaultName: string;
  minWidth: number;
  minLength: number;
  preferredWidth: number;
  preferredLength: number;
  maxArea: number;
  maxAspect: number;
  color: string;
  accent: string;
  icon: string;
  group: 'private' | 'public' | 'service' | 'circulation';
  typical: boolean;
}
```

Set per entry: bedroom `maxArea: 180, maxAspect: 1.6`; bathroom `maxArea: 80, maxAspect: 2.0`; kitchen `maxArea: 150, maxAspect: 1.6`; living `maxArea: 260, maxAspect: 1.8`. All other entries: `maxArea` = preferredWidth × preferredLength × 2, `maxAspect: 2.0`.

- [ ] **Step 4: Add hard validator errors**

In `validateLayout`, directly after the `DIMENSION_TOO_SMALL` warning block, add:

```ts
const area = r.width * r.length;
const aspect = Math.max(r.width, r.length) / Math.max(0.5, Math.min(r.width, r.length));
if (area > cat.maxArea + 0.5) {
  errors.push({
    code: 'ABOVE_MAX_AREA',
    message: `${r.name} (${Math.round(area)} sq.ft) exceeds the maximum ${cat.maxArea} sq.ft.`,
    roomId: r.id,
    roomName: r.name,
    severity: 'error',
  });
}
if (aspect > cat.maxAspect + 0.05) {
  errors.push({
    code: 'ABOVE_MAX_ASPECT',
    message: `${r.name} (${r.width}' × ${r.length}') exceeds the maximum aspect ${cat.maxAspect}.`,
    roomId: r.id,
    roomName: r.name,
    severity: 'error',
  });
}
```

`cat` is the existing `ROOM_CATALOG[r.type]` lookup in that loop — reuse it, do not add a second lookup.

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `bun test scripts/caps.test.ts`
Expected: PASS (4 tests).

Run: `bun x tsc --noEmit`
Expected: clean.

Run: `bun x eslint src/lib/room-catalog.ts src/lib/layout/validation.ts scripts/caps.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/room-catalog.ts src/lib/layout/validation.ts scripts/caps.test.ts
git commit -m "feat: room size/aspect caps with hard validation errors"
```

---

### Task 2: Normalizer stage

**Files:**
- Create: `src/lib/architecture/normalize.ts`
- Modify: `src/lib/layout/engine.ts` (call site in `generateLayout` before `distributeRoomsByFloor`)
- Test: `scripts/normalize.test.ts`

**Interfaces:**
- Consumes: `RoomRequirement[]` from `../types`.
- Produces: `normalizeRequirements(reqs: RoomRequirement[]): { reqs: RoomRequirement[]; assumptions: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/normalize.test.ts
import { describe, expect, test } from 'bun:test';
import { normalizeRequirements } from '../src/lib/architecture/normalize';
import type { RoomRequirement } from '../src/lib/types';

const mk = (type: RoomRequirement['type'], name: string): RoomRequirement => ({
  type, name, count: 1, minWidth: 5, minLength: 5,
  preferredWidth: 6, preferredLength: 6, priority: 'medium',
});

describe('normalizeRequirements', () => {
  test('adds a ground foyer when missing', () => {
    const { reqs, assumptions } = normalizeRequirements([mk('living', 'Living'), mk('kitchen', 'Kitchen')]);
    expect(reqs.some((r) => r.type === 'foyer')).toBe(true);
    expect(assumptions.length).toBeGreaterThan(0);
  });
  test('adds dining when kitchen exists without dining', () => {
    const { reqs } = normalizeRequirements([mk('living', 'Living'), mk('kitchen', 'Kitchen')]);
    expect(reqs.some((r) => r.type === 'dining')).toBe(true);
  });
  test('never duplicates an existing foyer', () => {
    const { reqs } = normalizeRequirements([mk('foyer', 'Foyer'), mk('living', 'Living')]);
    expect(reqs.filter((r) => r.type === 'foyer').length).toBe(1);
  });
  test('does not add dining when no kitchen exists', () => {
    const { reqs } = normalizeRequirements([mk('living', 'Living'), mk('bedroom', 'Bedroom')]);
    expect(reqs.some((r) => r.type === 'dining')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/normalize.test.ts`
Expected: FAIL with "Cannot find module" for `normalize.ts`.

- [ ] **Step 3: Implement the normalizer**

```ts
// src/lib/architecture/normalize.ts
import type { RoomRequirement } from '../types';

export function normalizeRequirements(reqs: RoomRequirement[]): { reqs: RoomRequirement[]; assumptions: string[] } {
  const out = [...reqs];
  const assumptions: string[] = [];
  const has = (t: RoomRequirement['type']) => out.some((r) => r.type === t);
  if (!has('foyer')) {
    out.push({
      type: 'foyer', name: 'Foyer', count: 1,
      minWidth: 5, minLength: 5, preferredWidth: 6, preferredLength: 6,
      priority: 'high',
    });
    assumptions.push('No foyer requested — added a 6×6 ground foyer as the entry buffer.');
  }
  if (has('kitchen') && !has('dining')) {
    out.push({
      type: 'dining', name: 'Dining', count: 1,
      minWidth: 8, minLength: 10, preferredWidth: 10, preferredLength: 12,
      priority: 'high',
    });
    assumptions.push('Kitchen without dining — added a 10×12 dining for the serving link.');
  }
  return { reqs: out, assumptions };
}
```

- [ ] **Step 4: Wire into `generateLayout`**

At the top of `generateLayout` in `src/lib/layout/engine.ts`, before `distributeRoomsByFloor`:

```ts
const normalized = normalizeRequirements(config.rooms);
const byFloor = distributeRoomsByFloor(normalized.reqs, config.floors, config.floorAssignment);
```

Replace the existing `distributeRoomsByFloor(config.rooms, ...)` call. Keep the Upper Lobby rule in `distributeRoomsByFloor` untouched. Merge `normalized.assumptions` into each scored layout's assumptions in `toScored` callers: append to `extra.assumptions` in `generateDesignOptions` and `generateAIDesignOptions` via the layout reasoning path (thread through `generateLayout` return is out of scope — pass assumptions out through the existing `reasoning`/`assumptions` fields on `ScoredLayout`).

Simplest compliant wiring: change `generateLayout` signature to accept the config only (unchanged), and have it internally normalize; then in `generateDesignOptions`/`generateAIDesignOptions`, call `normalizeRequirements(config.rooms)` once and concat assumptions into `extra.assumptions`.

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `bun test scripts/normalize.test.ts`
Expected: PASS (4 tests).

Run: `bun x tsc --noEmit`
Expected: clean.

Run: `bun x eslint src/lib/architecture/normalize.ts src/lib/layout/engine.ts scripts/normalize.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/architecture/normalize.ts src/lib/layout/engine.ts scripts/normalize.test.ts
git commit -m "feat: requirements normalizer auto-adds foyer and dining"
```

---

### Task 3: Band assignment before BSP

**Files:**
- Modify: `src/lib/architecture/planner.ts` (add `BAND_MAP` + `assignBands`)
- Modify: `src/lib/layout/engine.ts` (`generateFloorLayout`: band-split then pack per band)
- Test: `scripts/bands.test.ts`

**Interfaces:**
- Consumes: normalized `RoomRequirement[]`, `Rect` footprint, floor index (0 = ground).
- Produces: `assignBands(reqs: RoomRequirement[], floor: number): { band: string; reqs: RoomRequirement[] }[]`; `BAND_MAP: Record<string, RoomRequirement['type'][]>` with keys `ground-entry`, `ground-social`, `ground-service`, `upper-front`, `upper-rear`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/bands.test.ts
import { describe, expect, test } from 'bun:test';
import { assignBands, BAND_MAP } from '../src/lib/architecture/planner';

describe('band assignment', () => {
  test('ground entry band holds foyer and living', () => {
    expect(BAND_MAP['ground-entry']).toContain('foyer');
    expect(BAND_MAP['ground-entry']).toContain('living');
  });
  test('kitchen is in ground-service, never entry', () => {
    expect(BAND_MAP['ground-service']).toContain('kitchen');
    expect(BAND_MAP['ground-entry']).not.toContain('kitchen');
  });
  test('bedrooms map to upper-rear, balcony to upper-front', () => {
    const bands = assignBands([
      { type: 'bedroom', name: 'B1', count: 1, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' },
      { type: 'balcony', name: 'Bal', count: 1, minWidth: 4, minLength: 6, preferredWidth: 5, preferredLength: 8, priority: 'low' },
    ], 1);
    expect(bands.find((b) => b.reqs.some((r) => r.type === 'bedroom'))?.band).toBe('upper-rear');
    expect(bands.find((b) => b.reqs.some((r) => r.type === 'balcony'))?.band).toBe('upper-front');
  });
  test('unknown floor keeps rooms in a single band', () => {
    const bands = assignBands([
      { type: 'living', name: 'L', count: 1, minWidth: 10, minLength: 12, preferredWidth: 14, preferredLength: 16, priority: 'high' },
    ], 0);
    expect(bands.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/bands.test.ts`
Expected: FAIL with `assignBands` not exported.

- [ ] **Step 3: Add BAND_MAP + assignBands to planner.ts**

```ts
export const BAND_MAP: Record<string, RoomRequirement['type'][]> = {
  'ground-entry': ['foyer', 'living'],
  'ground-social': ['dining', 'bathroom'],
  'ground-service': ['kitchen', 'utility', 'store'],
  'ground-private': ['bedroom', 'pooja', 'office'],
  'upper-front': ['balcony', 'foyer'],
  'upper-rear': ['bedroom', 'bathroom', 'pooja', 'office'],
};

export function assignBands(reqs: RoomRequirement[], floor: number): { band: string; reqs: RoomRequirement[] }[] {
  const order = floor === 0
    ? ['ground-entry', 'ground-social', 'ground-service', 'ground-private']
    : ['upper-front', 'upper-rear'];
  const groups = order.map((band) => ({ band, reqs: [] as RoomRequirement[] }));
  for (const r of reqs) {
    if (r.type === 'parking') continue;
    const idx = order.findIndex((b) => (BAND_MAP[b] || []).includes(r.type));
    groups[idx < 0 ? groups.length - 1 : idx].reqs.push(r);
  }
  return groups.filter((g) => g.reqs.length > 0);
}
```

Unmapped types fall into the last band (rear/service) — deterministic and documented here, not silent: the band name appears in AI assumptions via existing anchor notes.

- [ ] **Step 4: Pack per band in `generateFloorLayout`**

Replace the single `allocateZones(houseRect, houseReqs, ...)` + `placeZoneRooms` block with per-band packing:

```ts
import { ROOM_CATALOG } from '../room-catalog';

const bandGroups = assignBands(houseReqs, floor);
const prefOf = (r: RoomRequirement) => {
  const cat = ROOM_CATALOG[r.type];
  return (r.preferredWidth || cat.preferredWidth) * (r.preferredLength || cat.preferredLength);
};
const totals = bandGroups.map((g) => g.reqs.reduce((s, r) => s + prefOf(r), 0));
const grand = totals.reduce((a, b) => a + b, 0) || 1;
// South/east roads: front strip starts at the high edge and moves down/left.
// North/west roads: front strip starts at the low edge and moves up/right.
const horizontal = config.plot.roadSide === 'south' || config.plot.roadSide === 'north';
const fromHigh = config.plot.roadSide === 'south' || config.plot.roadSide === 'east';
let cursor = fromHigh
  ? (horizontal ? houseRect.y + houseRect.h : houseRect.x + houseRect.w)
  : (horizontal ? houseRect.y : houseRect.x);
// Far edge: the last band takes everything remaining up to it, so strips
// tile the rect exactly even when earlier bands consumed nothing.
const farEdge = horizontal
  ? (fromHigh ? houseRect.y : houseRect.y + houseRect.h)
  : (fromHigh ? houseRect.x : houseRect.x + houseRect.w);
bandGroups.forEach((g, i) => {
  const frac = bandTotals[i] / bandGrand;
  if (horizontal) {
    const depth = i === bandGroups.length - 1
      ? Math.abs(farEdge - cursor)
      : Math.round(houseRect.h * frac * 2) / 2;
    const rect: Rect = fromHigh
      ? { x: houseRect.x, y: cursor - depth, w: houseRect.w, h: depth }
      : { x: houseRect.x, y: cursor, w: houseRect.w, h: depth };
    cursor += fromHigh ? -depth : depth;
    placed.push(...optimizeAdjacencies(placeZoneRooms({ zone: 'public', rooms: g.reqs, rect }, floor, config.plot, strategy, rankOf)));
  } else {
    const depth = i === bandGroups.length - 1
      ? Math.abs(farEdge - cursor)
      : Math.round(houseRect.w * frac * 2) / 2;
    const rect: Rect = fromHigh
      ? { x: cursor - depth, y: houseRect.y, w: depth, h: houseRect.h }
      : { x: cursor, y: houseRect.y, w: depth, h: houseRect.h };
    cursor += fromHigh ? -depth : depth;
    placed.push(...optimizeAdjacencies(placeZoneRooms({ zone: 'public', rooms: g.reqs, rect }, floor, config.plot, strategy, rankOf)));
  }
});
```

Notes: the last band takes the remainder so strips tile `houseRect` exactly (no void slivers from rounding). South road front is high-Y (bottom strip first); north mirrors it; east/west split along X the same way. `assignBands` already returns bands in front→rear order for the given floor; do not re-sort here. Keep the porch-column logic and `optimizeAdjacencies` per cluster untouched. Keep `allocateZones` exported (do not delete — other modules import its types). `Rect`, `RoomRequirement`, and `ROOM_CATALOG` imports: add `ROOM_CATALOG` to `engine.ts` (the other two are already imported).

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `bun test scripts/bands.test.ts scripts/normalize.test.ts scripts/caps.test.ts`
Expected: PASS.

Run: `bun x tsc --noEmit`
Expected: clean.

Run: `bun x eslint src/lib/architecture/planner.ts src/lib/layout/engine.ts scripts/bands.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/architecture/planner.ts src/lib/layout/engine.ts scripts/bands.test.ts
git commit -m "feat: front-to-rear band assignment before BSP packing"
```

---

### Task 4: Invariant checks + external-window rule

**Files:**
- Modify: `src/lib/layout/validation.ts` (reachability, door presence, area conservation)
- Modify: `src/lib/layout/doors.ts` (tag interior windows)
- Test: `scripts/invariants.test.ts`

**Interfaces:**
- Consumes: `LayoutData`, existing `sharedWallOf`, `DoorMarker`.
- Produces: validation codes `FOYER_UNREACHABLE`, `ROOM_WITHOUT_DOOR`, `NO_EXTERNAL_WINDOW`, `AREA_MISMATCH` (error above 5%, warning outside 2%).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/invariants.test.ts
import { describe, expect, test } from 'bun:test';
import { validateLayout } from '../src/lib/layout/validation';
import type { LayoutData, ProjectConfig } from '../src/lib/types';

const plot = { width: 30, length: 40, unit: 'ft' as const, roadSide: 'south' as const, northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3 };
const config = { plot, floors: 1, rooms: [], style: 'modern' as const, preferences: [], vastuEnabled: false, vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null } } as ProjectConfig;

const room = (over: Partial<LayoutData['rooms'][number]>): LayoutData['rooms'][number] => ({
  id: over.id ?? 'r1', type: 'living', name: 'Living', x: 3, y: 20, width: 14, length: 12, floor: 0,
  doors: [{ wall: 'bottom', pos: 0.5, width: 3.5, swing: 'out-right' }], windows: [], ...over,
});

describe('invariants', () => {
  test('room without doors is an error', () => {
    const layout = { plot, floors: 1, rooms: [{ ...room(), doors: [] }], furniture: [], strategy: 'space-optimized' } as LayoutData;
    const v = validateLayout(layout, config);
    expect(v.errors.some((e) => e.code === 'ROOM_WITHOUT_DOOR')).toBe(true);
  });
  test('bedroom reachable only through another bedroom is an error', () => {
    const foyer = room({ id: 'f', type: 'foyer', name: 'Foyer', x: 3, y: 30, width: 6, length: 6 });
    const bedA = room({ id: 'a', type: 'bedroom', name: 'A', x: 3, y: 20, width: 10, length: 10, doors: [{ wall: 'bottom', pos: 0.5, width: 3, swing: 'in-right' }] });
    const bedB = room({ id: 'b', type: 'bedroom', name: 'B', x: 3, y: 10, width: 10, length: 10, doors: [{ wall: 'bottom', pos: 0.5, width: 3, swing: 'in-right' }] });
    const layout = { plot, floors: 1, rooms: [foyer, bedA, bedB], furniture: [], strategy: 'space-optimized' } as LayoutData;
    const v = validateLayout(layout, config);
    expect(v.errors.some((e) => e.code === 'FOYER_UNREACHABLE')).toBe(true);
  });
});
```

Note: the BFS treats rooms as nodes, shared-wall doors as edges, bedrooms as blocking passage (destination allowed, transit forbidden).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/invariants.test.ts`
Expected: FAIL with zero matching errors (codes do not exist yet).

- [ ] **Step 3: Implement the checks**

In `validateLayout`, per floor: build door-graph edges via existing `sharedWallOf` + door-on-shared-wall test (reuse the `doorOpensInto` helper pattern already in the file). BFS from foyer/lobby rooms; bedrooms are sinks (reachable as destination, never transit). Unreached non-bedroom rooms and bedrooms reached only via bedrooms → `FOYER_UNREACHABLE` error. Rooms with zero doors → `ROOM_WITHOUT_DOOR` error. Habitable rooms (living, bedroom, kitchen, dining) with no window on a plot/buildable-edge wall → `NO_EXTERNAL_WINDOW` error — in `doors.ts`, add `external: boolean` to `WindowMarker` placement in `solveWindows` (true when the wall is at the plot or buildable edge using the existing `getBuildableBounds` helper); validator counts only `external` windows.

Area conservation per floor: `|sum(rooms) + bookedCirculation − buildable| / buildable` where `buildable` is the existing `buildableArea(plot, floor)` helper (already imported in `validation.ts`) — plot area minus setbacks, NOT the full plot, since rooms tile the buildable area and setbacks are never packed. bookedCirculation is currently 0 (no circulation bookkeeping exists yet — pass 0). Outside 2% → warning `AREA_MISMATCH`; above 5% → error `AREA_MISMATCH` with severity `error`.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `bun test scripts/invariants.test.ts scripts/caps.test.ts scripts/normalize.test.ts scripts/bands.test.ts`
Expected: PASS.

Run: `bun x tsc --noEmit`
Expected: clean. Note: adding `external` to window markers requires updating `WindowMarker` in `src/lib/types.ts` as `external?: boolean` (optional so existing constructors keep compiling).

Run: `bun x eslint src/lib/layout/validation.ts src/lib/layout/doors.ts src/lib/types.ts scripts/invariants.test.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/layout/validation.ts src/lib/layout/doors.ts src/lib/types.ts scripts/invariants.test.ts
git commit -m "feat: foyer-reachability, door, window and area invariants"
```

---

### Task 5: Pack-target clamp, absorber cap, fixtures, worklog

**Files:**
- Modify: `src/lib/layout/engine.ts` (target clamp + absorber cap + `TYPE_MAX_INFLATION` removal), `src/lib/architecture/planner.ts` (delete `TYPE_MAX_INFLATION` block)
- Create: `scripts/layout-fixtures.test.ts`
- Modify: `worklog.md` (append)

**Interfaces:**
- Consumes: caps from Task 1, bands from Task 3.
- Produces: fixture suite asserting zero hard failures; worklog entries.

- [ ] **Step 1: Write the failing fixture test**

```ts
// scripts/layout-fixtures.test.ts
import { describe, expect, test } from 'bun:test';
import { generateDesignOptions } from '../src/lib/layout/engine';
import { validateLayout } from '../src/lib/layout/validation';
import type { ProjectConfig } from '../src/lib/types';

const base = { unit: 'ft' as const, northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3 };
const rooms = [
  { type: 'living', name: 'Living', count: 1, minWidth: 12, minLength: 14, preferredWidth: 14, preferredLength: 16, priority: 'high' as const },
  { type: 'kitchen', name: 'Kitchen', count: 1, minWidth: 8, minLength: 8, preferredWidth: 10, preferredLength: 10, priority: 'high' as const },
  { type: 'bedroom', name: 'Bedroom', count: 2, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' as const },
  { type: 'bathroom', name: 'Bathroom', count: 1, minWidth: 5, minLength: 7, preferredWidth: 7, preferredLength: 8, priority: 'medium' as const },
  { type: 'parking', name: 'Parking', count: 1, minWidth: 9, minLength: 18, preferredWidth: 10, preferredLength: 18, priority: 'high' as const },
] as ProjectConfig['rooms'];

describe('fixtures: zero hard failures', () => {
  for (const roadSide of ['south', 'north', 'east', 'west'] as const) {
    test(`30x40 2-floor, road ${roadSide}`, () => {
      const config: ProjectConfig = {
        plot: { ...base, width: 30, length: 40, roadSide }, floors: 2, rooms,
        style: 'modern', preferences: [], vastuEnabled: false,
        vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
      };
      for (const d of generateDesignOptions(config)) {
        const v = validateLayout(d.layout, config);
        expect(`${d.strategy}: ${v.errors.map((e) => e.code + ':' + e.message).join('; ')}`).toBe(`${d.strategy}: `);
      }
    });
  }
  test('20x30 1-floor, road south', () => {
    const config: ProjectConfig = {
      plot: { ...base, width: 20, length: 30, roadSide: 'south' as const }, floors: 1, rooms,
      style: 'modern', preferences: [], vastuEnabled: false,
      vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
    };
    for (const d of generateDesignOptions(config)) {
      const v = validateLayout(d.layout, config);
      expect(v.errors).toEqual([]);
    }
  });
  test('40x60 3-floor, road south', () => {
    const config: ProjectConfig = {
      plot: { ...base, width: 40, length: 60, roadSide: 'south' as const }, floors: 3, rooms,
      style: 'modern', preferences: [], vastuEnabled: false,
      vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
    };
    for (const d of generateDesignOptions(config)) {
      const v = validateLayout(d.layout, config);
      expect(v.errors).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run fixtures to verify they fail**

Run: `bun test scripts/layout-fixtures.test.ts`
Expected: FAIL (cap errors fire on oversized rooms; proves the test detects the bug class).

- [ ] **Step 3: Clamp pack targets and cap the absorber**

In `planner.ts` `packRect`: after computing `targets`, clamp each target to its catalog max: `targets[i] = Math.min(targets[i], cat.maxArea)` using `ROOM_CATALOG[sorted[i].type].maxArea` (import already exists in the file). In the absorber block, cap `inflated` at the absorber's catalog max as well. Delete the `TYPE_MAX_INFLATION` record and its loop (replaced by absolute caps). In `engine.ts` `capKitchenVsLiving`, keep as-is (complementary, below max).

- [ ] **Step 4: Run the full suite until green**

Run: `bun test scripts/`
Expected: all PASS. If a fixture still errors, fix the band split or target clamp that caused it (one variable at a time), never loosen a cap.

Run: `bun x tsc --noEmit` — clean. Run: `bun x eslint src/lib/architecture/planner.ts src/lib/layout/engine.ts scripts/layout-fixtures.test.ts` — clean.

- [ ] **Step 5: Regenerate the screenshot scenario and append worklog**

Run the 30×40 south-road 2-floor config from the screenshots through `generateDesignOptions`; confirm foyer + dining present, no full-width bathroom strip, kitchen outside the front band, stair landing in the upper lobby, all rooms within caps. Append a dated entry to `worklog.md` describing what changed and why (normalizer, bands, caps, invariants, fixtures).

- [ ] **Step 6: Commit**

```bash
git add src/lib/architecture/planner.ts src/lib/layout/engine.ts scripts/layout-fixtures.test.ts worklog.md
git commit -m "feat: cap-clamped packing, layout fixtures, worklog"
```
