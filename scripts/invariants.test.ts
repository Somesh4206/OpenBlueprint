import { describe, expect, test } from 'bun:test';
import { validateLayout } from '../src/lib/layout/validation';
import type { LayoutData, ProjectConfig } from '../src/lib/types';

const plot = { width: 30, length: 40, unit: 'ft' as const, roadSide: 'south' as const, northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3 };
const config = { plot, floors: 1, rooms: [], style: 'modern' as const, preferences: [], vastuEnabled: false, vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null } } as ProjectConfig;

const room = (over: Partial<LayoutData['rooms'][number]> = {}): LayoutData['rooms'][number] => ({
  id: over.id ?? 'r1', type: 'living', name: 'Living', x: 3, y: 20, width: 14, length: 12, floor: 0,
  doors: [{ wall: 'bottom', pos: 0.5, width: 3.5, swing: 'out-right' }], windows: [], ...over,
});

describe('invariants', () => {
  test('room without doors is an error', () => {
    const layout = { plot, floors: 1, rooms: [{ ...room(), doors: [] }], furniture: [], strategy: 'space-optimized' } as LayoutData;
    const v = validateLayout(layout, config);
    expect(v.errors.some((e) => e.code === 'ROOM_WITHOUT_DOOR')).toBe(true);
  });
  test('bedroom reachable only through another bedroom is an error', () => {
    const foyer = room({ id: 'f', type: 'foyer', name: 'Foyer', x: 3, y: 30, width: 6, length: 6 });
    const bedA = room({ id: 'a', type: 'bedroom', name: 'A', x: 3, y: 20, width: 10, length: 10, doors: [{ wall: 'bottom', pos: 0.5, width: 3, swing: 'in-right' }] });
    const bedB = room({ id: 'b', type: 'bedroom', name: 'B', x: 3, y: 10, width: 10, length: 10, doors: [{ wall: 'bottom', pos: 0.5, width: 3, swing: 'in-right' }] });
    const layout = { plot, floors: 1, rooms: [foyer, bedA, bedB], furniture: [], strategy: 'space-optimized' } as LayoutData;
    const v = validateLayout(layout, config);
    expect(v.errors.some((e) => e.code === 'FOYER_UNREACHABLE')).toBe(true);
  });
});
