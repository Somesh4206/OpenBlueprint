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

const SYSTEM_PROMPT = `You are OpenBlueprint AI, an intelligent architectural design assistant integrated into a floor-plan planning workspace.

Your job: interpret a user's natural-language request about their floor plan and translate it into a SMALL list of STRUCTURED design actions that the layout engine can apply. You must NOT calculate exact coordinates or dimensions yourself — the engine does that.

Available action types:
- resize-room: change a room's size. Use deltaW / deltaL in feet (positive = larger, negative = smaller).
- move-room: relocate a room. Use targetLocation: "front" | "rear" | "side" | "center".
- add-room: add a new room. Use roomType from the catalog, and an optional targetRoomType to attach it to.
- remove-room: remove a room. Use roomName to target a specific named room.
- rename-room: rename a room. Use roomName (current) and a newName field.
- rearrange: request the engine to re-run layout generation with a different emphasis. Use targetLocation as a hint like "open", "privacy", "ventilation", "compact".
- note: when the request is informational or cannot be structured, return a single note action with a description.

Room types available: ${Object.keys(ROOM_CATALOG).join(', ')}.

Guidelines:
- Return 1-4 actions max.
- Prefer the simplest set of actions that satisfies the request.
- If the user asks for something that requires full regeneration (e.g. "more open layout"), use a single "rearrange" action.
- If the request is ambiguous, infer the most likely intent and proceed.
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

  if (m.includes('kitchen') && (m.includes('larg') || m.includes('big'))) {
    actions.push({ type: 'resize-room', description: 'Increase kitchen area', roomType: 'kitchen', deltaW: 2, deltaL: 2 });
  } else if (m.includes('balcony')) {
    actions.push({ type: 'add-room', description: 'Add a balcony', roomType: 'balcony', targetRoomType: 'bedroom' });
  } else if (m.includes('master') && m.includes('rear')) {
    actions.push({ type: 'move-room', description: 'Move master bedroom to the rear', roomType: 'bedroom', targetLocation: 'rear' });
  } else if (m.includes('parking')) {
    actions.push({ type: 'resize-room', description: 'Increase parking space', roomType: 'parking', deltaW: 2, deltaL: 0 });
  } else if (m.includes('living') && (m.includes('spacious') || m.includes('larg'))) {
    actions.push({ type: 'resize-room', description: 'Make living room more spacious', roomType: 'living', deltaW: 2, deltaL: 2 });
  } else if (m.includes('open')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout for a more open plan', targetLocation: 'open' });
  } else if (m.includes('privacy')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout with privacy emphasis', targetLocation: 'privacy' });
  } else if (m.includes('bathroom') && m.includes('add')) {
    actions.push({ type: 'add-room', description: 'Add a bathroom', roomType: 'bathroom', targetRoomType: 'bedroom' });
  } else if (m.includes('ventilat')) {
    actions.push({ type: 'rearrange', description: 'Re-run layout for better ventilation', targetLocation: 'ventilation' });
  } else {
    actions.push({ type: 'note', description: 'I could not fully parse the request — try rephrasing. Examples: "make the kitchen larger", "add a balcony", "more open layout", "move master bedroom to rear".' });
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
