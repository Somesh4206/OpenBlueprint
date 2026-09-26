import { describe, expect, test } from 'bun:test';
import { DEFAULT_CHOICE, floorFootprint, generateLayout } from '../src/lib/layout/engine';
import type { LayoutChoice, ProjectConfig } from '../src/lib/types';

const plot = {
  width: 30, length: 40, unit: 'ft' as const, roadSide: 'south' as const,
  northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3,
};
const rooms = [
  { type: 'living', name: 'Living', count: 1, minWidth: 12, minLength: 14, preferredWidth: 14, preferredLength: 16, priority: 'high' },
  { type: 'kitchen', name: 'Kitchen', count: 1, minWidth: 8, minLength: 8, preferredWidth: 10, preferredLength: 10, priority: 'high' },
  { type: 'dining', name: 'Dining', count: 1, minWidth: 8, minLength: 10, preferredWidth: 10, preferredLength: 12, priority: 'medium' },
  { type: 'bedroom', name: 'Bedroom', count: 2, minWidth: 10, minLength: 12, preferredWidth: 12, preferredLength: 14, priority: 'high' },
  { type: 'bathroom', name: 'Bathroom', count: 2, minWidth: 5, minLength: 7, preferredWidth: 7, preferredLength: 8, priority: 'medium' },
  { type: 'parking', name: 'Parking', count: 1, minWidth: 9, minLength: 18, preferredWidth: 10, preferredLength: 18, priority: 'high' },
] as ProjectConfig['rooms'];
const config = (over: Partial<ProjectConfig> = {}): ProjectConfig => ({
  plot, floors: 2, rooms, style: 'modern', preferences: [], vastuEnabled: false,
  vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null }, ...over,
});
const choices: LayoutChoice[] = [
  DEFAULT_CHOICE,
  { ...DEFAULT_CHOICE, mirror: true },
  { ...DEFAULT_CHOICE, kitchenCorner: 'rear-right' },
  { ...DEFAULT_CHOICE, bandOrder: 1 },
];

describe('engine: choice-driven, zero-gap', () => {
  test('never invents a Garden or Terrace', () => {
    for (const c of choices) {
      for (const roadSide of ['north', 'south', 'east', 'west'] as const) {
        const l = generateLayout(config({ plot: { ...plot, roadSide } }), c);
        expect(l.rooms.filter((r) => /garden|terrace/i.test(r.name)).map((r) => r.name)).toEqual([]);
      }
    }
  });
  test('rooms tile each floor footprint with no gap', () => {
    for (const c of choices) {
      const l = generateLayout(config(), c);
      for (let f = 0; f < l.floors; f++) {
        const fp = floorFootprint(l.plot, f, true);
        const fr = l.rooms.filter((r) => r.floor === f);
        const sum = fr.reduce((s, r) => s + r.width * r.length, 0);
        expect(Math.abs(sum - fp.w * fp.h)).toBeLessThanOrEqual(0.5 * fr.length + 1);
      }
    }
  });
  test('same config and choice give identical output, ids included', () => {
    for (const c of choices) expect(generateLayout(config(), c)).toEqual(generateLayout(config(), c));
  });
  test('mirror reflects every room across the axis parallel to the road', () => {
    const base = generateLayout(config(), DEFAULT_CHOICE);
    const mir = generateLayout(config(), { ...DEFAULT_CHOICE, mirror: true });
    expect(mir.rooms.length).toBe(base.rooms.length);
    base.rooms.forEach((r, i) => {
      const m = mir.rooms[i];
      expect(m.name).toBe(r.name);
      expect(m.x).toBeCloseTo(plot.width - r.x - r.width, 5);
      expect(m.y).toBeCloseTo(r.y, 5);
    });
  });
  test('kitchen side and band order change real geometry', () => {
    const key = (c: LayoutChoice) =>
      generateLayout(config(), c).rooms.map((r) => `${r.name}@${r.x},${r.y},${r.width},${r.length}`).join('|');
    expect(key({ ...DEFAULT_CHOICE, kitchenCorner: 'rear-right' })).not.toBe(key(DEFAULT_CHOICE));
    expect(key({ ...DEFAULT_CHOICE, bandOrder: 1 })).not.toBe(key(DEFAULT_CHOICE));
  });
});
