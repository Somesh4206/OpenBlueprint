# OpenBlueprint Context-Band Pipeline — Design Spec

Date: 2026-09-19. Approach: band-constrained packing (option A).
Source: AI Context §1–§9 plus the two 30×40 screenshots (Ground broken, First somewhat okay).

## Goal

Make the generator obey the AI Context end to end: normalized requirements,
front→rear band placement, absolute size/aspect caps, and validator-enforced
invariants — with the four fixtures passing zero hard failures.

## Architecture

One new pipeline stage (normalizer) plus constraints threaded through the two
existing geometry stages. Determinism is preserved: same input, same plan.
Rule priority: hard rules > adjacency > user preference > Vastu > strategy
flavour. The LLM contract is unchanged (intent only, never coordinates).

Pipeline after this change:

wizard → normalizer → floor distribution (human confirms) → band assignment
→ engine (BSP inside bands) → validator (+invariant checks) → repair loop
(max 3) → scorer → UI.

## Components

### 1. Normalizer — `src/lib/architecture/normalize.ts` (new)

Runs on expanded requirements before floor distribution. Adds only what is
missing, never duplicates, and returns an assumption list:

- Ground foyer 6×6 when no foyer exists (multi- and single-floor).
- Dining 10×12 when a kitchen exists without dining (serving-link rule).
- Upper Lobby per upper floor stays in `distributeRoomsByFloor` (existing).
- Staircase remains furniture, not a room (existing `autoPlaceFurniture`).

`buildPlanningContext` in `src/lib/ai/blueprint-planner.ts` consumes the
normalized list so the AI FLOOR BRIEF and the ruler agree.

### 2. Band assignment — `src/lib/architecture/planner.ts`

New config map (per floor index: ground vs upper), front defined as road
side. Ground bands: entry (foyer, stair-lobby use, living) → social
(dining, common bath) → service (kitchen, utility, store); parking carved
at the road as today; the porch column feeds the entry band. Upper bands:
front (balcony, lobby) → rear (bedrooms, attached baths, pooja/office).
`packRect` runs inside each band rect unchanged; AI anchors order rooms
within a band only. Rooms never cross bands; bands tile the footprint.

### 3. Size and aspect caps — `src/lib/room-catalog.ts` + `rules.ts`

Caps live in config, no magic numbers in code:

| Room     | Area (sq ft) | Max aspect |
|----------|--------------|------------|
| Bedroom  | 100–180      | 1.6        |
| Bathroom | 35–80        | 2.0        |
| Kitchen  | 80–150       | 1.6        |
| Living   | 150–260      | 1.8        |

Pack targets clamp to [min, max]. The leftover absorber is capped at max;
area beyond max is booked to circulation, balcony, or open-to-sky — rooms
are never stretched. Exceeding max area or max aspect is a hard validator
error. Existing `TYPE_MAX_INFLATION` is removed in favour of these caps.

### 4. Invariant checks — `src/lib/layout/validation.ts`, `doors.ts`

- Reachability: door-graph BFS from the ground foyer / upper lobby; every
  room reachable without passing through a bedroom (bedroom-as-passage =
  hard error).
- Every room has at least one door (hard error otherwise).
- Habitable rooms (living, bedroom, kitchen, dining) need a window on an
  external wall: only plot/buildable-edge walls count. The recessed-wall
  fallback in `solveWindows` may still place a window, but it no longer
  satisfies this check.
- Area conservation: room areas + booked circulation equals floor footprint
  within 2% tolerance (warning outside, error above 5%).
- Repair loop unchanged: pairwise rect swaps, max 3 retries.

### 5. Coordinates, fixtures, log

No coordinate refactor. Code stays y-down from the top-left; the mapping to
the context convention (origin front-left seen from the road, y road→rear)
is documented per roadSide in this spec: south road — code +y runs toward
the road (inverted vs context); north — aligned; east/west — rotated.
Band code keeps using road-relative front/rear helpers. Fixtures that must
pass with zero hard failures: 30×40 2-floor, 20×30 1-floor, 40×60 3-floor,
each with road on all four sides. Every change on this track is logged in
`worklog.md`.

## Data flow

Normalized reqs → per-floor split (confirmed) → band rects → packed
`RoomRect`s → doors/windows → prohibited-door repair → validator +
invariants → swap repair (≤3) → score. AI plan placements map onto bands;
out-of-band AI anchors are recorded as assumptions, never silently moved.

## Error handling

- Normalizer additions are visible in the review step (assumption list),
  never silent.
- Unplaceable band (rooms below minimums at footprint): hard error naming
  the band and shortfall; no sliver rooms.
- Repair exhaustion: plan is returned flagged invalid with error codes; UI
  gating unchanged.

## Testing

- `bun x tsc --noEmit` and eslint on touched files.
- Fixture script generating all fixture × road-side combos, asserting zero
  hard failures and printing area/aspect/reachability summaries.
- Regression: the 30×40 south-road duplex from the screenshots regenerates
  with foyer + dining present, no full-width bathroom strip, kitchen out of
  the front band, stair landing in the upper lobby, and all rooms within
  caps.
