# Core Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 3–5 distinct, valid, preference-honoring floor plans with zero gaps, one aligned staircase, and no invented rooms.

**Architecture:** Keep the band/BSP engine. Add a `LayoutChoice` tuple the engine realizes as geometry, a stair core reserved before packing, a fixed/flex band fill, preference rules in the validator, a deterministic conflict check that returns clarifying questions, and a variant search that keeps the best distinct designs.

**Tech Stack:** Next.js 16, TypeScript 5, bun test, React Three Fiber.

**Spec:** `docs/superpowers/specs/2026-09-26-core-generator-design.md`

## Global Constraints

- Determinism: identical `ProjectConfig` → identical designs, same order. No `Math.random` in generation paths; `genId` must be seeded per generation.
- Floor height 10 ft. Stair: dog-leg 7×10 ft default, straight 3.5×13 ft when narrow. No smaller fallback.
- Distinctness threshold 0.10 (mean matched-centroid displacement ÷ plot diagonal). Max 5 designs.
- Fixed types: bathroom, store, pooja, utility, parking, foyer. Flex types: living, bedroom, dining, kitchen. Office, balcony: fixed.
- Flex over maxArea → warning. Fixed over maxArea, below min, or above maxAspect → error.
- Area conservation: Σ room areas + stair core = floor footprint, tolerance 0.5 sq ft per room.
- No room enters the plan unless requested, accepted as a suggestion, or required circulation (upper Lobby).

## Review Focus

1. Plot too narrow for any stair (e.g. 20 ft wide, 2 floors) → a clarifying question or `blocked` entry, never a crash or an empty design list with no reason.
2. Single-floor plan → no stair core, no lobby, no STAIR_* errors.
3. Vastu on with road on the Vastu corner side → kitchen-corner knob collapses to one value; search still yields ≥1 design or a conflict question.
4. Saved projects from before this change (no `stair`, legacy `strategy`) → workspace still opens and renders.
5. User edits a room in the 2D editor after generation → validation still runs without a stair-alignment false positive on single-floor layouts.

Each is pinned by a test in the owning task (Tasks 4, 5, 7, 8, 9).

---

### Task 1: Baseline

**Files:** none changed.

- [ ] Run `bun install`. Expected: completes, `node_modules` present.
- [ ] Run `bun test scripts/` and record baseline: 15 pass / 5 fail (fixtures).
- [ ] Run `bun run lint` and record the baseline error count.

### Task 2: Types and catalog

**Files:** Modify `src/lib/types.ts`, `src/lib/room-catalog.ts`. Test: `scripts/catalog.test.ts`.

**Interfaces — Produces:**
- `type Sizing = 'fixed' | 'flex'`; `RoomCatalogEntry.sizing: Sizing`.
- `interface StairCore { x: number; y: number; width: number; length: number; kind: 'dog-leg' | 'straight' }`.
- `interface LayoutChoice { mirror: boolean; stairSlot: 'left' | 'center' | 'right'; kitchenCorner: 'rear-left' | 'rear-right'; bandOrder: 0 | 1 }`.
- `LayoutData` gains `stair?: StairCore; choice?: LayoutChoice; choiceLabel?: string`. `strategy` becomes optional (legacy saved projects).
- `ScoredLayout` gains `choice?: LayoutChoice`; `strategy` optional.
- `interface BlockedReason { rule: string; message: string }`.

- [ ] Test `sizing matches spec`: every fixed type above has `sizing==='fixed'`; living/bedroom/dining/kitchen `'flex'`.
- [ ] Implement; run `bun test scripts/catalog.test.ts` → PASS; `bunx tsc --noEmit` shows no new errors from optional `strategy` (fix call sites with `?? ` fallbacks).
- [ ] Commit `feat: sizing, stair core and layout choice types`.

### Task 3: Suggestions instead of auto-added rooms; opt-in balcony

**Files:** Modify `src/lib/architecture/normalize.ts`, `src/lib/ai/blueprint-planner.ts` (consumer), `src/lib/templates.ts`, `src/components/openblueprint/wizard/wizard.tsx`. Test: `scripts/normalize.test.ts` (rewrite).

**Interfaces — Produces:**
- `normalizeRequirements(reqs, preferences: PreferenceKey[]): { reqs: RoomRequirement[]; suggestions: RoomSuggestion[] }`
- `interface RoomSuggestion { type: 'foyer' | 'dining'; reason: string; requirement: RoomRequirement }`
- `normalizeRequirements` adds exactly one Balcony (5×8, attachedTo 'bedroom') when `balcony-bedroom` is on and none exists; never adds foyer/dining.

- [ ] Tests: no foyer/dining added, only suggested; balcony added only with pref; existing balcony not duplicated.
- [ ] Implement. Remove `'balcony'` from BHK presets in `wizard.tsx` and from `templates.ts` rooms/previews.
- [ ] Wizard review step: render each suggestion as a pre-ticked checkbox; ticked ones are appended to `config.rooms` on Generate.
- [ ] Run tests → PASS. Commit `feat: suggest foyer/dining, opt-in balcony`.

### Task 4: Stair core — `src/lib/layout/stair.ts`

**Files:** Create `src/lib/layout/stair.ts`. Test: `scripts/stair.test.ts`.

**Interfaces — Produces:**
- `const FLOOR_HEIGHT_FT = 10`
- `sizeStair(footprint: Rect): { width: number; length: number; kind: StairCore['kind'] } | null` — dog-leg 7×10 if footprint.w ≥ 7 and h ≥ 10 leaving ≥ 10 ft for rooms across; else straight 3.5×13; else null.
- `reserveStair(footprint: Rect, slot: LayoutChoice['stairSlot'], circulationY: number, fromHigh: boolean): StairCore | null`
- `checkStair(layout: LayoutData): ValidationIssue[]` — STAIR_MISALIGNED, STAIR_TOO_SMALL, STAIR_BAD_ACCESS, missing core on multi-floor.

- [ ] Tests: 30 ft wide → dog-leg; 12 ft wide → straight; 3 ft wide → null; left/center/right slots differ in x; `checkStair` on single-floor layout → `[]` (Review Focus 2); core adjacent only to bedroom → STAIR_BAD_ACCESS.
- [ ] Implement; run → PASS. Commit `feat: stair core sizing, reservation, checks`.

### Task 5: Engine — choice-driven, stair-first, zero-gap fill

**Files:** Modify `src/lib/layout/engine.ts`. Test: `scripts/engine-fill.test.ts`.

**Interfaces — Consumes:** Task 2 types, Task 4 `reserveStair`.
**Produces:** `generateLayout(config: ProjectConfig, choice: LayoutChoice, aiPlan?: AIPlan): LayoutData` (replaces strategy arg).

- [ ] Tests: no room named Garden/Terrace ever; per-floor Σarea + stair = footprint ±0.5/room; stair rect identical on every floor of a 2-floor build; `mirror:true` reflects x of every room about the footprint centre line; fixed rooms within catalog maxArea; same config+choice twice → deep-equal output (ids included).
- [ ] Remove `STRATEGIES`, `strategyBias`, garden block; `orderRank` keeps AI anchor, tie-break by stable name.
- [ ] Reserve stair on every floor first; pack bands around it (stair cell carved from the circulation band).
- [ ] Band fill: fixed rooms at preferred size clamped to band depth, flex rooms share remainder by preferred area; no-flex band grows the lobby.
- [ ] `kitchenCorner` / `bandOrder` steer placement; Vastu kitchen corner overrides `kitchenCorner`.
- [ ] Seed `genId` per `generateLayout` call.
- [ ] Remove stair-as-furniture placement from `autoPlaceFurniture`.
- [ ] Run → PASS. Commit `feat: choice-driven engine with stair core and zero-gap fill`.

### Task 6: Validator — preferences, balcony, sizing, area

**Files:** Modify `src/lib/layout/validation.ts`. Test: `scripts/preferences.test.ts`.

- [ ] Tests, one per preference: rule holds on a generated layout when on; a hand-built violating layout errors when on and passes when off. UNREQUESTED_BALCONY when pref off and balcony not in `config.rooms`. Flex room at 1.2×maxArea → warning only; bathroom at 1.2×maxArea → error. AREA_MISMATCH at >0.5/room gap.
- [ ] Implement codes: PREF_KITCHEN_DINING, PREF_MASTER_BATH, PREF_BALCONY, PREF_OPEN_PLAN, PREF_NATURAL_LIGHT, UNREQUESTED_BALCONY; call `checkStair`; replace old NO_STAIRCASE furniture check.
- [ ] Run → PASS. Commit `feat: preference rules and sizing policy in validator`.

### Task 7: Variant search — `src/lib/layout/variants.ts`

**Files:** Create `src/lib/layout/variants.ts`; modify `engine.ts` exports `generateDesignOptions`, `generateAIDesignOptions` to delegate. Test: `scripts/variants.test.ts`.

**Interfaces — Produces:**
- `enumerateChoices(config: ProjectConfig): LayoutChoice[]` (fixed order; Vastu collapses kitchenCorner)
- `layoutDistance(a: LayoutData, b: LayoutData): number`
- `searchDesigns(config: ProjectConfig, aiPlan?: AIPlan): { designs: ScoredLayout[]; blocked: BlockedReason[] }`
- `choiceLabel(c: LayoutChoice): string` e.g. "Stair left · kitchen rear-right · mirrored"

- [ ] Tests: ≤ 24 choices; Vastu on → kitchenCorner single-valued (Review Focus 3); every returned design validates with zero errors; pairwise distance ≥ 0.10; 3–5 designs for the 30×40 fixture; `searchDesigns` twice → identical; impossible config → `designs.length===0` and `blocked.length>0` (Review Focus 1).
- [ ] Implement; scoring = `scoreLayout` total + 10 × preference-satisfaction fraction.
- [ ] Update `scripts/layout-fixtures.test.ts` to call `searchDesigns` and label by `choiceLabel`; all fixtures PASS.
- [ ] Commit `feat: deterministic variant search with distinct selection`.

### Task 8: Conflict check and route

**Files:** Create `src/lib/layout/conflicts.ts`; modify `src/app/api/layout/generate/route.ts`. Test: `scripts/conflicts.test.ts`.

**Interfaces — Produces:**
- `findConflicts(config: ProjectConfig): ClarifyingQuestion[]` (ids prefixed `conflict:`)
- `applyConflictAnswers(config: ProjectConfig, answers: PlanAnswers): ProjectConfig`

- [ ] Tests: attached-bath with 0 bathrooms → question, answer "Add a bathroom" adds one; 20 ft plot 2 floors with 4 bedrooms → floor-size question; answers remove the conflict (re-run returns `[]`).
- [ ] Route: apply `conflict:` answers, run `findConflicts` first (422 with questions if any), then AI path as today, then `searchDesigns`; response carries `blocked` instead of `allInvalid`. Offline path uses `searchDesigns`.
- [ ] Commit `feat: generator conflict questions and blocked reasons`.

### Task 9: UI — options, canvas, 3D stair

**Files:** Modify `design-options.tsx`, `blueprint-canvas.tsx`, `viewer-3d.tsx`, `wizard.tsx` (blocked/conflict display), `store.ts` if it references strategy.

- [ ] Design options: show `choiceLabel`; show `blocked` messages when fewer than 3 designs.
- [ ] Canvas: draw `layout.stair` on every floor as a stair symbol; drag moves it on all floors.
- [ ] 3D: render `layout.stair` as one flight per floor gap at the core rect.
- [ ] Legacy layouts without `stair` render as before (Review Focus 4); editing a single-floor plan raises no STAIR_* issue (Review Focus 5 — add test to `scripts/stair.test.ts`).
- [ ] Commit `feat: render stair core and variant labels`.

### Task 10: Verification

- [ ] `bun test scripts/` → all pass.
- [ ] `bun run lint` → no new errors vs baseline.
- [ ] `bun run build` (or `bunx next build`) → success.
- [ ] Start dev server, generate the 30×40 2-floor offline design, confirm 3–5 distinct designs render in 2D and 3D.
- [ ] Commit any fixes.
