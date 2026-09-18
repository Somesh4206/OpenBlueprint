// OpenBlueprint AI — reason-then-place blueprint planner.
//
// The LLM REASONS first (zones, anchors, adjacencies, doors, assumptions,
// doubts) and returns a semantic plan as JSON. A deterministic solver then
// realizes exact geometry, so output is always valid rectangles with no
// overlaps. This keeps AI as the brain and code as the ruler.
//
// Full user context (plot + rooms + preferences + vastu + style + floors)
// is serialized into the prompt — preferences actually steer generation now.

import { LayoutStrategy, ProjectConfig, RoomRequirement, RoomType } from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { AIConfig, AITruncatedError, chatJSON } from './provider';
import { distributeRoomsByFloor, expandRequirements } from '../layout/engine';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface RoomPlacement {
  /** matches an expanded requirement instance, e.g. "Master Bedroom" */
  name: string;
  type: RoomType;
  /** zone cluster */
  zone: 'public' | 'private' | 'service';
  /** where in the floor: front = road side, rear = away, side, center */
  anchor: 'front' | 'rear' | 'side' | 'center';
  /** room types this room must touch (wall-share) */
  adjacentTo: RoomType[];
  /** room types this room must NEVER touch on the same floor */
  avoidAdjacency: RoomType[];
  /** which neighbor its door should open toward */
  doorTo?: RoomType;
  note?: string;
}

export interface FloorPlan {
  floor: number;
  reasoning: string;
  placements: RoomPlacement[];
}

export interface AIPlan {
  reasoning: string;
  assumptions: string[];
  /** non-empty when the AI is unsure — caller must ask the user (human-in-the-loop) */
  questions: ClarifyingQuestion[];
  floors: FloorPlan[];
}

export interface PlanAnswers {
  [questionId: string]: string;
}

const PLANNER_SYSTEM = `You are OpenBlueprint AI, a senior residential architect planning Indian homes.
You REASON about layout like an architect, then output a SEMANTIC plan as strict JSON.
You do NOT output coordinates — a geometry solver places exact rectangles from your plan.

NON-NEGOTIABLE RULES (violating any of these fails validation):
1. ZONE CLUSTERING: public (living, dining, foyer, balcony) at FRONT near road; private (bedroom, bathroom, office, pooja) at REAR away from road; service (parking, kitchen, store, utility) at SIDE/front edge. Kitchen bridges public+service but sits near dining.
2. HARD ADJACENCY: kitchen MUST touch dining and/or living. Dining touches kitchen/living. Bathrooms touch the bedroom they serve. Store touches kitchen. Parking touches road. Foyer/living is the entry sequence.
3. PROHIBITED: bedroom NEVER adjacent to parking on the same floor. Bathroom NEVER adjacent to living/dining/kitchen. Kitchen NEVER adjacent to bathroom. Bedroom is never a passage.
4. PRIVACY GRADIENT: entry → living → dining/kitchen → bedrooms → service. Bedrooms face away from street; living faces street.
5. ENTRY SEQUENCE: road → parking/foyer → living → rest. Never enter through a bedroom, kitchen, or bathroom.
6. VASTU (only when enabled): entrance per pref, kitchen SE/NW, master bedroom SW/S, pooja NE/E. Vastu NEVER overrides rules 1-5; note conflicts in assumptions.
7. PREFERENCES are hard inputs: kitchen-near-dining forces kitchen-dining adjacency; master-attached-bath forces an attached bath to Master Bedroom; balcony-bedroom attaches balcony to a bedroom; max-natural-light puts bedrooms/living on outer walls; open-plan clusters living+dining+kitchen together.
8. FLOOR FIDELITY: the FLOOR BRIEF below is authoritative (user-confirmed split). Place every listed instance on its listed floor with its EXACT name. Never move rooms between floors, never drop/merge/invent. If you believe the split is wrong, say so in questions — do NOT silently re-split.

ARCHITECTURAL PLANNING REFERENCE (Indian residential, NBC-flavoured — follow unless a user pref explicitly conflicts, and note the conflict):
- Standard sizes: living 12×14 or bigger (always the largest social space); master bedroom 12×14 on the quiet side with attached bath; other bedrooms 10×12+; kitchen 10×10 in SE (fallback NW), cook facing east; dining 10×12 with a direct serving link from kitchen; baths 5×8 attached to the bedroom they serve, never opening into living/dining; pooja small and quiet in NE/E; office/study in E/N for morning light; parking 9×18 at the road with direct entry; foyer 5×6+ as a buffer between entry and living; staircase 3–3.5 ft wide, reachable from living/foyer, stacked at the same XY on every floor.
- Entry always lands in foyer/living — never through a bedroom, kitchen or bath. A powder bath near the entry is allowed only with a foyer buffer.
- Every habitable room (living/bedroom/kitchen/dining) gets an outer wall and a window; corner rooms get cross-ventilation; baths get small vent windows.
- Doors: entry 3.5 ft, interior 3 ft, bath 2.5 ft. No bedroom door faces the main entry.
- Vertical logic: public life on the ground (entry/living/dining/kitchen), private rest above (bedrooms/baths); balconies attach to bedrooms or upper living and face E/N light.
- Proportions: living ≥ dining ≥ kitchen by area; corridors and foyer keep ≥3 ft clear.

DOUBT PROTOCOL (human-in-the-loop): if inputs conflict (e.g. tight plot vs room count, Vastu vs road side, open-plan vs privacy need, kitchen and dining on different floors), do NOT guess silently. Put 1-3 sharp questions in "questions" with 2-4 concrete options each, and still provide your best-effort placements.
NEVER ASK about normal things: multiple bedrooms/bathrooms of the same type across floors is NORMAL (a 3-bedroom home has 3 bedrooms — that is not a conflict). Bedrooms upstairs with living/kitchen downstairs is the DEFAULT duplex pattern, not a doubt. Only ask when two hard inputs genuinely collide.

EFFICIENCY: keep any internal deliberation under 250 words, then output the JSON. No essays — the JSON plan IS the deliverable.

Respond with STRICT JSON only, shape:
{
  "reasoning": "4-8 sentences: zone strategy, entry sequence, key adjacencies, how preferences/vastu shaped it",
  "assumptions": ["..."],
  "questions": [{"id":"q1","question":"...","options":["..."]}],
  "floors": [{"floor":0,"reasoning":"...","placements":[{"name":"...","type":"bedroom","zone":"private","anchor":"rear","adjacentTo":["bathroom"],"avoidAdjacency":["parking"],"doorTo":"bathroom"}]}]
}
Types allowed: bedroom, bathroom, kitchen, living, dining, parking, balcony, pooja, office, utility, staircase, foyer, store.`;

export function buildPlanningContext(config: ProjectConfig, expandedNames: string[]): string {
  const prefMeanings: Record<string, string> = {
    'kitchen-near-dining': 'kitchen MUST be adjacent to dining',
    'master-attached-bath': 'Master Bedroom MUST have an attached bathroom',
    'balcony-bedroom': 'balcony attached to a bedroom',
    'max-natural-light': 'bedrooms/living on outer walls with windows',
    'open-plan': 'cluster living+dining+kitchen as one open zone',
  };
  const rooms = config.rooms
    .map((r: RoomRequirement) => {
      const cat = ROOM_CATALOG[r.type];
      return `- ${r.name} ×${r.count} [${r.type}]: pref ${r.preferredWidth}×${r.preferredLength} ft, min ${r.minWidth}×${r.minLength} ft, priority ${r.priority}, preferredLocation ${r.preferredLocation || 'any'}${r.attachedTo ? `, attachedTo ${r.attachedTo}` : ''} (catalog group: ${cat.group})`;
    })
    .join('\n');
  const knownPrefs = config.preferences.filter((p) => prefMeanings[p]);
  const prefs = knownPrefs.length
    ? knownPrefs.map((p) => `- ${p}: ${prefMeanings[p]}`).join('\n')
    : '(none — use default architectural judgment)';
  const vastu = config.vastuEnabled
    ? `ENABLED: entrance ${config.vastu.entrance || 'any'}, kitchen ${config.vastu.kitchen || 'any'}, bedroom ${config.vastu.bedroom || 'any'}, pooja ${config.vastu.pooja || 'any'}`
    : 'OFF (ignore Vastu)';
  // Exact per-floor split (user-confirmed via the floor dialog, or the
  // deterministic default). This is what the geometry solver will realize —
  // the AI must plan THESE instances on THESE floors.
  const floorNames = ['Ground', 'First', 'Second', 'Third', 'Fourth'];
  let floorBrief = '';
  try {
    const byFloor = distributeRoomsByFloor(config.rooms, config.floors, config.floorAssignment);
    floorBrief = byFloor
      .map((reqs, f) => {
        const names = expandRequirements(reqs).map((r) => `${r.name} [${r.type}]`);
        return `Floor ${f} (${floorNames[f] || `Level ${f}`}): ${names.length ? names.join(', ') : '(empty — flag this in questions if unintended)'}`;
      })
      .join('\n');
  } catch {
    floorBrief = expandedNames.join(', ');
  }
  return `PLOT: ${config.plot.width}×${config.plot.length} ${config.plot.unit}, road on ${config.plot.roadSide}, north ${config.plot.northDirection}°. Setbacks: front ${config.plot.setbackFront}, rear ${config.plot.setbackRear}, sides ${config.plot.setbackSides}. Buildable = plot minus setbacks.
FLOORS: ${config.floors}${config.floorAssignment ? ' (user-confirmed split below)' : ' (default split below)'}
STYLE: ${config.style}
FLOOR BRIEF (authoritative — place EXACTLY these instances on each floor):
${floorBrief}
ROOM REQUIREMENTS (sizes/priorities):
${rooms}
SPATIAL PREFERENCES:
${prefs}
VASTU: ${vastu}`;
}

/**
 * Ask the LLM to reason + plan. Throws on provider errors.
 * `budgetBoost` (tokens) stacks when the caller retries after a truncation —
 * some models emit long thought blocks that share max_tokens with the JSON,
 * so the budget escalates instead of failing with jargon at the user.
 */
export async function requestAIPlan(
  cfg: AIConfig,
  config: ProjectConfig,
  expandedNames: string[],
  answers?: PlanAnswers,
  strategyHint?: LayoutStrategy,
  budgetBoost = 0,
): Promise<AIPlan> {
  const context = buildPlanningContext(config, expandedNames);
  const answerBlock = answers && Object.keys(answers).length
    ? `\nUSER CLARIFICATIONS (respect these exactly):\n${Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : '';
  const strategyBlock = strategyHint
    ? `\nDESIGN EMPHASIS for this variant: ${strategyHint} (space-optimized = compact efficient; ventilation-optimized = outer walls + cross-breeze; modern-open = open living/dining/kitchen cluster; privacy-optimized = bedrooms deep rear, buffered; vastu-optimized = Vastu quadrants within rules 1-5).`
    : '';
  const budget = 4500 + Math.max(0, Math.min(9000, budgetBoost));
  try {
    const raw = await chatJSON<Partial<AIPlan>>(
      cfg,
      PLANNER_SYSTEM,
      `${context}${answerBlock}${strategyBlock}\n\nReturn the JSON plan now.`,
      { temperature: 0.2, maxTokens: budget, timeoutMs: 60000 },
    );
    return normalizePlan(raw, expandedNames);
  } catch (e) {
    // Truncated mid-plan: one automatic escalation with +4000 tokens, then
    // give up honestly. Never surface "max_tokens" jargon to the user —
    // the route maps this to plain language.
    if (e instanceof AITruncatedError && budgetBoost < 9000) {
      return requestAIPlan(cfg, config, expandedNames, answers, strategyHint, budgetBoost + 4000);
    }
    throw e;
  }
}

function normalizePlan(raw: Partial<AIPlan>, expandedNames: string[]): AIPlan {
  const floors = Array.isArray(raw.floors) ? raw.floors : [];
  return {
    reasoning: String(raw.reasoning || 'AI-planned layout following zone clustering and adjacency rules.'),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String).slice(0, 8) : [],
    questions: Array.isArray(raw.questions)
      ? raw.questions
        .filter((q) => q && typeof q.question === 'string')
        .slice(0, 3)
        .map((q, i) => ({
          id: String(q.id || `q${i + 1}`),
          question: String(q.question),
          options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
        }))
      : [],
    floors: floors.map((f, i) => ({
      floor: typeof f.floor === 'number' ? f.floor : i,
      reasoning: String(f.reasoning || ''),
      placements: Array.isArray(f.placements)
        ? f.placements
            .filter((p) => p && typeof p.name === 'string' && typeof p.type === 'string')
            .map((p) => ({
              name: String(p.name),
              type: p.type as RoomType,
              zone: p.zone === 'private' || p.zone === 'service' ? p.zone : 'public',
              anchor: p.anchor === 'rear' || p.anchor === 'side' || p.anchor === 'center' ? p.anchor : 'front',
              adjacentTo: Array.isArray(p.adjacentTo) ? p.adjacentTo.filter((t): t is RoomType => typeof t === 'string') : [],
              avoidAdjacency: Array.isArray(p.avoidAdjacency) ? p.avoidAdjacency.filter((t): t is RoomType => typeof t === 'string') : [],
              doorTo: typeof p.doorTo === 'string' ? (p.doorTo as RoomType) : undefined,
              note: typeof p.note === 'string' ? p.note : undefined,
            }))
        : [],
    })),
  };
}
