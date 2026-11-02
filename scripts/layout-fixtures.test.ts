import { describe, expect, test } from 'bun:test';
import { generateDesignOptions } from '../src/lib/layout/engine';
import { validateLayout } from '../src/lib/layout/validation';
import type { ProjectConfig } from '../src/lib/types';

const base = { unit: 'ft' as const, northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3 };
const living = { type: 'living', name: 'Living', count: 1, minWidth: 12, minLength: 14, preferredWidth: 14, preferredLength: 16, priority: 'high' as const };
const kitchen = { type: 'kitchen', name: 'Kitchen', count: 1, minWidth: 8, minLength: 8, preferredWidth: 10, preferredLength: 10, priority: 'high' as const };
const bath = { type: 'bathroom', name: 'Bathroom', count: 1, minWidth: 5, minLength: 7, preferredWidth: 7, preferredLength: 8, priority: 'medium' as const };
const parking = { type: 'parking', name: 'Parking', count: 1, minWidth: 9, minLength: 18, preferredWidth: 10, preferredLength: 18, priority: 'high' as const };
// Programs sized to their plots: sparse programs cannot tile within caps,
// so each fixture carries a realistic room density for its footprint.
const rooms3040 = [
  living, kitchen,
  { type: 'bedroom', name: 'Bedroom', count: 2, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' as const },
  bath, parking,
] as ProjectConfig['rooms'];
const rooms2030 = [
  living, kitchen,
  { type: 'bedroom', name: 'Bedroom', count: 1, minWidth: 10, minLength: 12, preferredWidth: 11, preferredLength: 12, priority: 'high' as const },
  bath,
  // NOTE: no parking — a 10x18 bay plus turning space cannot fit a 20x30
  // footprint alongside habitable rooms (street parking assumed).
] as ProjectConfig['rooms'];
const rooms4060 = [
  living, kitchen,
  { type: 'bedroom', name: 'Bedroom', count: 3, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' as const },
  { type: 'bathroom', name: 'Bathroom', count: 2, minWidth: 5, minLength: 7, preferredWidth: 7, preferredLength: 8, priority: 'medium' as const },
  parking,
  { type: 'office', name: 'Office', count: 1, minWidth: 8, minLength: 8, preferredWidth: 10, preferredLength: 10, priority: 'low' as const },
  { type: 'pooja', name: 'Pooja', count: 1, minWidth: 4, minLength: 4, preferredWidth: 5, preferredLength: 6, priority: 'low' as const },
  { type: 'store', name: 'Store', count: 1, minWidth: 4, minLength: 4, preferredWidth: 5, preferredLength: 6, priority: 'low' as const },
  { type: 'utility', name: 'Utility', count: 1, minWidth: 5, minLength: 6, preferredWidth: 6, preferredLength: 8, priority: 'low' as const },
  { type: 'balcony', name: 'Balcony', count: 1, minWidth: 4, minLength: 6, preferredWidth: 5, preferredLength: 8, priority: 'low' as const },
] as ProjectConfig['rooms'];

describe('fixtures: zero hard failures', () => {
  for (const roadSide of ['south', 'north', 'east', 'west'] as const) {
    test(`30x40 2-floor, road ${roadSide}`, () => {
      const config: ProjectConfig = {
        plot: { ...base, width: 30, length: 40, roadSide }, floors: 2, rooms: rooms3040,
        style: 'modern', preferences: [], vastuEnabled: false,
        vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
      };
      for (const d of generateDesignOptions(config)) {
        const v = validateLayout(d.layout, config);
        expect(`${d.strategy}: ${v.errors.map((e) => e.code + ':' + e.message).join('; ')}`).toBe(`${d.strategy}: `);
      }
    });
  }
  test('20x30 1-floor, road south', () => {
    const config: ProjectConfig = {
      plot: { ...base, width: 20, length: 30, roadSide: 'south' as const }, floors: 1, rooms: rooms2030,
      style: 'modern', preferences: [], vastuEnabled: false,
      vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
    };
    for (const d of generateDesignOptions(config)) {
      const v = validateLayout(d.layout, config);
      expect(v.errors).toEqual([]);
    }
  });
  test('40x60 3-floor, road south', () => {
    const config: ProjectConfig = {
      plot: { ...base, width: 40, length: 60, roadSide: 'south' as const }, floors: 3, rooms: rooms4060,
      style: 'modern', preferences: [], vastuEnabled: false,
      vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null },
    };
    for (const d of generateDesignOptions(config)) {
      const v = validateLayout(d.layout, config);
      expect(v.errors).toEqual([]);
    }
  });
});
