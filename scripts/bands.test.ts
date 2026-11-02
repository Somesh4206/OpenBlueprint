import { describe, expect, test } from 'bun:test';
import { assignBands, BAND_MAP } from '../src/lib/architecture/planner';

describe('band assignment', () => {
  test('ground entry band holds foyer and living', () => {
    expect(BAND_MAP['ground-entry']).toContain('foyer');
    expect(BAND_MAP['ground-entry']).toContain('living');
  });
  test('kitchen is in ground-service, never entry', () => {
    expect(BAND_MAP['ground-service']).toContain('kitchen');
    expect(BAND_MAP['ground-entry']).not.toContain('kitchen');
  });
  test('bedrooms map to upper-rear, balcony to upper-front', () => {
    const bands = assignBands([
      { type: 'bedroom', name: 'B1', count: 1, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' },
      { type: 'balcony', name: 'Bal', count: 1, minWidth: 4, minLength: 6, preferredWidth: 5, preferredLength: 8, priority: 'low' },
    ], 1);
    expect(bands.find((b) => b.reqs.some((r) => r.type === 'bedroom'))?.band).toBe('upper-rear');
    expect(bands.find((b) => b.reqs.some((r) => r.type === 'balcony'))?.band).toBe('upper-front');
  });
  test('unknown floor keeps rooms in a single band', () => {
    const bands = assignBands([
      { type: 'living', name: 'L', count: 1, minWidth: 10, minLength: 12, preferredWidth: 14, preferredLength: 16, priority: 'high' },
    ], 0);
    expect(bands.length).toBe(1);
  });
});
