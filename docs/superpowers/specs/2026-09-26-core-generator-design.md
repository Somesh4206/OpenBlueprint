# Core Generator — Design Spec

Date: 2026-09-26. Part 1 of 4 (core generator → AI flow → 3D → cleanup).
Approach A: layout choices + deterministic search.

## Goal

The generator produces 3–5 genuinely different, valid floor plans that honor
every user preference, fill each floor with zero gaps, stack one staircase
through all floors, and never add a room the user did not ask for or accept.

## Current defects this fixes

- The 5 "strategies" only change sort order (`engine.ts:384`), so designs look
  alike and none of them read user preferences — preferences exist only in the
  AI prompt; the engine and validator never check them.
- Leftover strips become an invented "Garden"/"Terrace" (`engine.ts:791-829`).
- Balconies appear uninvited via BHK presets (`wizard.tsx:549-551`),
  templates (`templates.ts`), and the garden filler.
- Foyer and Dining are auto-added silently (`normalize.ts`).
- Staircase is placed last as furniture in whatever corner is free
  (`engine.ts:1149-1190`); it can shift between floors and fall back to a
  4×7 or 3×4 flight that cannot climb 10 ft. Validation only checks that some
  stair exists per floor (`validation.ts:342`).
- Layout fixtures: 5 of 6 fail (e.g. a 4 ft × 14 ft bathroom, a bathroom
  reachable only through a bedroom).

## Pipeline

requirements → normalize (suggestions only) → floor split → conflict check
(human-in-the-loop) → layout choices → reserve stair → pack floors → validate
→ score → pick distinct → 3–5 designs.

Determinism: same input produces the same designs in the same order.

## 1. Layout choices and variant selection — `src/lib/layout/variants.ts` (new)

A layout choice is a small tuple the engine turns into real geometry:

| Knob | Values |
|---|---|
| mirror | off, on (flip left/right relative to the road) |
| stairSlot | left, center, right of the circulation band |
| kitchenCorner | rear-left, rear-right (Vastu on: the Vastu corner only) |
| bandOrder | up to 2 allowed orderings of the middle bands |

At most ~24 combinations, enumerated in a fixed order. For each: generate,
validate, discard any with a hard error, score the rest (`scoring.ts` plus a
preference-satisfaction term). Selection is greedy: take the best, then add
the next best only if its room-placement distance from every picked design is
at least 0.10 (mean centroid displacement of rooms matched by name, divided by
the plot diagonal; a mirrored plan scores well above this). Stop at 5.

Labels describe the real difference (e.g. "Stair left · kitchen rear-right").
The `STRATEGIES` table and `strategyBias` are removed; `LayoutData.strategy`
is replaced by the choice tuple plus its label.

## 2. Staircase — `src/lib/layout/stair.ts` (new)

- The staircase becomes its own element (`StairCore`: x, y, w, h, kind), one per
  building, reserved on every floor before rooms are packed. Rooms pack around
  the reserved rect, so it cannot move between floors.
- Sizing from floor height 10 ft: dog-leg 7×10 ft default; straight 3.5×13 ft
  when the plot is narrow. No smaller fallback — if neither fits, that choice
  is rejected.
- Access: ground floor opens to foyer or living; upper floors to the lobby.
  Never into bedroom, bathroom, or kitchen. The top floor keeps the stairwell
  as lobby area.
- Hard checks: STAIR_MISALIGNED (rect differs across floors), STAIR_TOO_SMALL,
  STAIR_BAD_ACCESS (opens into a private or wet room), STAIR_DOES_NOT_FIT.
- 2D and 3D render it as one continuous element; the editor moves it on every
  floor together. The 3D viewer gets only the minimal change needed to render
  it; the visual rework is Part 3.

## 3. Preferences as hard rules — `validation.ts`

| Preference | Hard rule |
|---|---|
| kitchen-near-dining | kitchen and dining share ≥ 3 ft of wall with a door or opening |
| master-attached-bath | a bathroom shares a wall with Master Bedroom; its only door opens into it |
| balcony-bedroom | exactly one balcony, sharing a wall with a bedroom, entered from it, on an outer wall |
| open-plan | living, dining, kitchen form one connected block; no wall living↔dining |
| max-natural-light | every bedroom and living touches an outer wall (corner scores higher) |

A preference that is off is not enforced. Balconies are opt-in only:
UNREQUESTED_BALCONY is a hard error when `balcony-bedroom` is off and the user
did not add one explicitly (the design assistant's "add a balcony" is explicit).

## 4. Zero-gap fill — `engine.ts`, `room-catalog.ts`

- Each floor is split front (road) to rear into full-width bands that tile the
  footprint exactly. No remnant, no garden.
- Within a band: fixed rooms (bathroom, store, pooja, utility, parking, foyer)
  take their standard size first, clamped to band depth; flex rooms (living,
  bedroom, dining, kitchen) share the remainder in proportion to preferred
  area. A band with no flex room grows its lobby.
- `room-catalog.ts` gains `sizing: 'fixed' | 'flex'`.
- Size checks: flex room above maxArea → warning; fixed room above maxArea →
  error; below min, too narrow, or above maxAspect → error for all.
- AREA_MISMATCH: room areas + stair core must equal the floor footprint
  within rounding (0.5 sq ft per room).

## 5. No invented rooms — `normalize.ts`, wizard, templates

- `normalizeRequirements` returns suggestions instead of adding rooms:
  `{ reqs, suggestions: [{ type: 'foyer' | 'dining', reason }] }`.
- The wizard review step shows each suggestion as a pre-ticked checkbox; only
  ticked suggestions enter the requirements.
- Balcony removed from BHK presets and templates.
- Upper-floor Lobby stays: it is circulation required by the stair, not a room
  the user chooses. It is labelled as circulation.

## 6. Human-in-the-loop for generator conflicts — `src/lib/layout/conflicts.ts` (new)

Before searching, a deterministic conflict check looks for inputs that cannot
all be satisfied, and returns them as clarifying questions using the existing
422 `needsClarification` shape and dialog. Examples:

- master-attached-bath on but no bathroom available for the master →
  "Add a bathroom" / "Drop attached bath".
- balcony-bedroom on but no bedroom can reach an outer wall slot →
  "Move a bedroom upstairs" / "Drop balcony".
- Footprint too small for the stair plus requested rooms on a floor →
  "Add a floor" / "Remove a room" / "Move rooms to another floor".
- Vastu kitchen corner conflicts with the road side for every choice →
  "Keep Vastu corner (kitchen at front)" / "Relax Vastu for kitchen".

Each option maps to a concrete config change applied before generation. The
search also reports `blocked: [{ rule, message }]` when fewer than 3 designs
pass; the design picker shows these in plain language. This replaces
`allInvalid`.

AI doubts (the planner's own questions) and applying the user's answers to
the AI plan — currently discarded at `generate/route.ts:95` — are Part 2's
first item.

## 7. AI role in Part 1

The AI plan's anchors and adjacencies only order rooms within a band. They
never override a hard rule, and the engine must produce valid designs with
no AI plan at all.

## Files

New: `src/lib/layout/variants.ts`, `src/lib/layout/stair.ts`,
`src/lib/layout/conflicts.ts`.
Changed: `engine.ts`, `validation.ts`, `room-catalog.ts`, `types.ts`,
`normalize.ts`, `templates.ts`, `wizard.tsx`, `design-options.tsx`,
`blueprint-canvas.tsx`, `viewer-3d.tsx` (stair only), `generate/route.ts`.

## Testing (TDD, bun test)

- Existing 4 plot fixtures: zero hard errors across every returned design.
- Stair: same rect and size on every floor; access rule holds.
- Area conservation per floor.
- No balcony, foyer, or dining unless requested or accepted.
- Each preference: rule holds when on; not enforced when off.
- Determinism: identical designs for identical input.
- Distinctness: every pair of returned designs exceeds the distance threshold.
- Conflict check: each example above yields its question; answers resolve it.
- Then `bun run lint` and `next build`.

## Out of scope (later parts)

Part 2: AI answers applied to the plan, plan cache key, generation without an
API key. Part 3: 3D visual rework. Part 4: removal of dead files and features.
