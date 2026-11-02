import type { PreferenceKey, RoomRequirement } from '../types';

/** A room the planner recommends; it enters the plan only if the user keeps it. */
export interface RoomSuggestion {
  type: 'foyer' | 'dining';
  reason: string;
  requirement: RoomRequirement;
}

/**
 * Normalize requirements without inventing rooms. Foyer and dining are
 * returned as suggestions the wizard shows as checkboxes; the only room added
 * here is the balcony, and only when the user opted in via `balcony-bedroom`.
 */
export function normalizeRequirements(
  reqs: RoomRequirement[],
  preferences: PreferenceKey[] = [],
): { reqs: RoomRequirement[]; suggestions: RoomSuggestion[] } {
  const out = [...reqs];
  const suggestions: RoomSuggestion[] = [];
  const has = (t: RoomRequirement['type']) => out.some((r) => r.type === t && r.count > 0);
  if (!has('foyer')) {
    suggestions.push({
      type: 'foyer',
      reason: 'A small foyer buffers the main door from the living room.',
      requirement: {
        type: 'foyer', name: 'Foyer', count: 1,
        minWidth: 5, minLength: 5, preferredWidth: 6, preferredLength: 6,
        priority: 'medium',
      },
    });
  }
  if (has('kitchen') && !has('dining')) {
    suggestions.push({
      type: 'dining',
      reason: 'A dining area next to the kitchen gives a direct serving link.',
      requirement: {
        type: 'dining', name: 'Dining', count: 1,
        minWidth: 8, minLength: 10, preferredWidth: 10, preferredLength: 12,
        priority: 'medium',
      },
    });
  }
  if (preferences.includes('balcony-bedroom') && !has('balcony')) {
    out.push({
      type: 'balcony', name: 'Balcony', count: 1,
      minWidth: 4, minLength: 6, preferredWidth: 5, preferredLength: 8,
      priority: 'low', attachedTo: 'bedroom',
    });
  }
  return { reqs: out, suggestions };
}
