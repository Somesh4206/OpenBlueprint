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
