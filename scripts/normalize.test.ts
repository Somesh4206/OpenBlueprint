import { describe, expect, test } from 'bun:test';
import { normalizeRequirements } from '../src/lib/architecture/normalize';
import type { RoomRequirement } from '../src/lib/types';

const mk = (type: RoomRequirement['type'], name: string): RoomRequirement => ({
  type, name, count: 1, minWidth: 5, minLength: 5,
  preferredWidth: 6, preferredLength: 6, priority: 'medium',
});

describe('normalizeRequirements', () => {
  test('suggests a foyer instead of adding one', () => {
    const { reqs, suggestions } = normalizeRequirements([mk('living', 'Living'), mk('kitchen', 'Kitchen')], []);
    expect(reqs.some((r) => r.type === 'foyer')).toBe(false);
    expect(suggestions.map((s) => s.type)).toContain('foyer');
  });
  test('suggests dining when kitchen exists without dining', () => {
    const { reqs, suggestions } = normalizeRequirements([mk('living', 'Living'), mk('kitchen', 'Kitchen')], []);
    expect(reqs.some((r) => r.type === 'dining')).toBe(false);
    const dining = suggestions.find((s) => s.type === 'dining');
    expect(dining?.requirement.type).toBe('dining');
  });
  test('no foyer suggestion when a foyer exists', () => {
    const { suggestions } = normalizeRequirements([mk('foyer', 'Foyer'), mk('living', 'Living')], []);
    expect(suggestions.some((s) => s.type === 'foyer')).toBe(false);
  });
  test('no dining suggestion without a kitchen', () => {
    const { suggestions } = normalizeRequirements([mk('living', 'Living'), mk('bedroom', 'Bedroom')], []);
    expect(suggestions.some((s) => s.type === 'dining')).toBe(false);
  });
  test('adds one balcony only when balcony-bedroom is on', () => {
    const base = [mk('living', 'Living'), mk('bedroom', 'Bedroom')];
    expect(normalizeRequirements(base, []).reqs.some((r) => r.type === 'balcony')).toBe(false);
    const on = normalizeRequirements(base, ['balcony-bedroom']).reqs.filter((r) => r.type === 'balcony');
    expect(on.length).toBe(1);
    expect(on[0].attachedTo).toBe('bedroom');
  });
  test('does not duplicate an existing balcony', () => {
    const { reqs } = normalizeRequirements([mk('bedroom', 'Bedroom'), mk('balcony', 'Balcony')], ['balcony-bedroom']);
    expect(reqs.filter((r) => r.type === 'balcony').length).toBe(1);
  });
});
