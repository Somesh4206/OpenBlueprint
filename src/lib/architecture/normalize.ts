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
