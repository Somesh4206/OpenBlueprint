import ZAI from 'z-ai-web-dev-sdk';
import {
  AiAction,
  AiAssistantResponse,
  LayoutData,
  ProjectConfig,
  RoomType,
} from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { applyActions } from './apply-actions';
import { generateInsights } from './apply-actions';
import { INDIAN_ARCHITECTURE_CONTEXT } from '../indian-architecture';

const ARCHITECTURE_RULES = `NON-NEGOTIABLE ARCHITECTURAL RULES (the layout engine enforces these):

1. ZONE CLUSTERING:
   - PUBLIC ZONE: Entry, living, dining, kitchen — cluster together at the front (road side).
   - PRIVATE ZONE: Bedrooms, bathrooms, study — separated from public by circulation buffer, at the rear (away from street noise).
   - SERVICE ZONE: Garage, laundry, utility — at the noisy/service edge, away from bedrooms.

2. ADJACENCY (hard constraints):
   - Kitchen MUST be adjacent to dining and/or living. NEVER isolate kitchen.
   - Living and dining should be adjacent (visual connection).
   - Bathrooms near bedrooms they serve, NOT opening directly into living areas.
   - Garage NOT directly adjacent to bedrooms (noise/fume separation).
   - Entry opens into foyer or public zone, not through private zones.

3. CIRCULATION: Direct paths entry → public → private. No cut-through traffic past bedrooms.

4. KITCHEN WORK TRIANGLE: Sink, cooktop, refrigerator form a triangle (perimeter 12-22 ft).

5. PRIVACY GRADIENT: Most public (entry/living) → semi-public (dining/kitchen) → private (bedrooms) → service (garage). Bedrooms on quieter side, not facing street.

6. MINIMUM STANDARDS: Habitable room ≥ 80 sq.ft (9.5 m²), width ≥ 8 ft. Kitchen ≥ 54 sq.ft. Bathroom ≥ 20 sq.ft. At least one room ≥ 102 sq.ft.

7. PROHIBITED: Garage as first room without foyer buffer. Kitchen isolated from dining/living. Bathroom opening off living room. Bedroom as passage. Rooms narrower than minimums.`;

const SYSTEM_PROMPT = `You are OpenBlueprint AI, an intelligent architectural design assistant integrated into a floor-plan planning workspace for INDIAN residential plots.

${INDIAN_ARCHITECTURE_CONTEXT}

${ARCHITECTURE_RULES}

Your job: interpret a user's natural-language request about their floor plan and translate it into a SMALL list of STRUCTURED design actions that the layout engine can apply. You must NOT calculate exact coordinates or dimensions yourself — the engine does that.

Available action types:
- resize-room: change a room's size. Use deltaW / deltaL in feet (positive = larger, negative = smaller). Use roomType (e.g. "kitchen") to target a room type, OR roomName (e.g. "Master Bedroom") for a specific named room.
- move-room: relocate a room. Use targetLocation: "front" | "rear" | "side" | "center". Also accepts "sw" (south-west), "se", "ne", "nw" for Vastu-directional moves.
- add-room: add a new room. Use roomType from the catalog, and an optional targetRoomType to attach it to.
- remove-room: remove a room. Use roomName to target a specific named room.
- rename-room: rename a room. Use roomName (current) and a newName field.
- rearrange: request the engine to re-run layout generation with a different emphasis. Use targetLocation as a hint like "open", "privacy", "ventilation", "compact", "vastu".
- note: when the request is informational or cannot be structured, return a single note action with a description.

Room types available: ${Object.keys(ROOM_CATALOG).join(', ')}.

Guidelines:
- Return 1-4 actions max.
- Prefer the simplest set of actions that satisfies the request.
- If the user asks for something that requires full regeneration (e.g. "more open layout"), use a single "rearrange" action.
- If the request is ambiguous, infer the most likely intent and proceed.
- When the user mentions Vastu or direction, use move-room with the corresponding quadrant (sw/se/ne/nw).
- Keep "understood" short (one sentence). "explanation" should be 1-2 sentences explaining the structured changes.

Respond with STRICT JSON only (no markdown, no prose) in this exact shape:
{
  "understood": "...",
  "actions": [ { "type": "...", "description": "...", "roomType": "bedroom", "roomName": "Master Bedroom", "deltaW": 2, "deltaL": 0, "targetLocation": "rear", "targetRoomType": "bathroom", "newName": "..." } ],
  "explanation": "..."
}`;

export async function interpretDesignRequest(
  message: string,
  layout: LayoutData,
  config: ProjectConfig,
): Promise<AiAssistantResponse> {
  const zai = await ZAI.create();

  const layoutSummary = layout.rooms
    .map(
      (r) =>
        `- ${r.name} (${r.type}, ${r.width}'x${r.length}', floor ${r.floor + 1}, doors=${r.doors.length}, windows=${r.windows.length})`,
    )
    .join('\n');

  const userContent = `Plot: ${layout.plot.width}' x ${layout.plot.length}', ${layout.floors} floor(s), road on ${layout.plot.roadSide}.
Current rooms:
${layoutSummary}

User request: "${message}"

Return the structured JSON actions now.`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = parseJsonLoose(raw);
    const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const actions: AiAction[] = rawActions.slice(0, 4).map((a: Record<string, unknown>) => ({
      type: (a.type as AiAction['type']) || 'note',
      description: String(a.description || ''),
      roomType: a.roomType as RoomType | undefined,
      roomName: a.roomName as string | undefined,
      deltaW: typeof a.deltaW === 'number' ? a.deltaW : undefined,
      deltaL: typeof a.deltaL === 'number' ? a.deltaL : undefined,
      targetLocation: a.targetLocation as AiAction['targetLocation'],
      targetRoomType: a.targetRoomType as RoomType | undefined,
      newName: a.newName as string | undefined,
    }));

    const appliedLayout = applyActions(layout, config, actions);

    return {
      understood: String(parsed.understood || 'I understand your request.'),
      actions,
      explanation: String(parsed.explanation || 'Applying the requested changes.'),
      appliedLayout,
    };
  } catch {
    return fallbackInterpret(message, layout, config);
  }
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function fallbackInterpret(message: string, layout: LayoutData, config: ProjectConfig): AiAssistantResponse {
  const m = message.toLowerCase();
  const actions: AiAction[] = [];

  if (m.includes('kitchen') && (m.includes('larg') || m.includes('big') || m.includes('bigger') || m.includes('expand'))) {
    actions.push({ type: 'resize-room', description: 'Increase kitchen area by 3 ft', roomType: 'kitchen', deltaW: 3, deltaL: 2 });
  } else if (m.includes('balcony')) {
    actions.push({ type: 'add-room', description: 'Add a balcony attached to a bedroom', roomType: 'balcony', targetRoomType: 'bedroom' });
  } else if ((m.includes('master') || m.includes('bedroom')) && (m.includes('rear') || m.includes('back') || m.includes('sw') || m.includes('south-west'))) {
    actions.push({ type: 'move-room', description: 'Move master bedroom to the South-West (rear)', roomType: 'bedroom', targetLocation: 'sw' });
  } else if (m.includes('parking') && (m.includes('larg') || m.includes('more') || m.includes('big'))) {
    actions.push({ type: 'resize-room', description: 'Increase parking space by 3 ft', roomType: 'parking', deltaW: 3, deltaL: 0 });
  } else if (m.includes('living') && (m.includes('spacious') || m.includes('larg') || m.includes('big'))) {
    actions.push({ type: 'resize-room', description: 'Make living room more spacious (+3 ft)', roomType: 'living', deltaW: 3, deltaL: 3 });
  } else if (m.includes('living') && (m.includes('small') || m.includes('shrink') || m.includes('reduce'))) {
    actions.push({ type: 'resize-room', description: 'Reduce living room size (-2 ft)', roomType: 'living', deltaW: -2, deltaL: -2 });
  } else if (m.includes('open')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout for a more open plan', targetLocation: 'open' });
  } else if (m.includes('privacy')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout with privacy emphasis', targetLocation: 'privacy' });
  } else if (m.includes('bathroom') && (m.includes('add') || m.includes('new'))) {
    actions.push({ type: 'add-room', description: 'Add a bathroom attached to a bedroom', roomType: 'bathroom', targetRoomType: 'bedroom' });
  } else if (m.includes('ventilat') || m.includes('air') || m.includes('light')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout for better ventilation and natural light', targetLocation: 'ventilation' });
  } else if (m.includes('vastu')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout with Vastu-compliant room placement', targetLocation: 'vastu' });
  } else if (m.includes('pooja') || m.includes('puja')) {
    actions.push({ type: 'add-room', description: 'Add a pooja room in the North-East corner', roomType: 'pooja', targetLocation: 'ne' });
  } else if (m.includes('office') || m.includes('study')) {
    actions.push({ type: 'add-room', description: 'Add a home office', roomType: 'office' });
  } else if (m.includes('compact') || m.includes('optimize') || m.includes('space')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout to optimize space utilization', targetLocation: 'compact' });
  } else if ((m.includes('remove') || m.includes('delete')) && m.includes('bedroom')) {
    actions.push({ type: 'remove-room', description: 'Remove one bedroom', roomType: 'bedroom' });
  } else if (m.includes('wardrobe') || m.includes('storage') || m.includes('store')) {
    actions.push({ type: 'add-room', description: 'Add a store room', roomType: 'store' });
  } else if (m.includes('staircase') || m.includes('stairs')) {
    actions.push({ type: 'add-room', description: 'Ensure internal staircase', roomType: 'staircase' });
  } else {
    // Default: try to interpret as a resize of any mentioned room
    const roomTypes = ['bedroom', 'kitchen', 'living', 'dining', 'bathroom', 'parking', 'balcony', 'office', 'pooja'];
    const mentioned = roomTypes.find((rt) => m.includes(rt));
    if (mentioned) {
      actions.push({ type: 'resize-room', description: `Adjust ${mentioned} size`, roomType: mentioned as RoomType, deltaW: 2, deltaL: 2 });
    } else {
      actions.push({ type: 'note', description: 'I could not fully parse the request. Try: "make the kitchen larger", "add a balcony", "move master bedroom to SW", "more open layout", "add a pooja room", "Vastu compliant layout".' });
    }
  }

  const appliedLayout = applyActions(layout, config, actions);
  return {
    understood: 'I interpreted your request with the built-in rule engine.',
    actions,
    explanation: 'Applied local heuristics as a fallback.',
    appliedLayout,
  };
}

export { applyActions, generateInsights };
