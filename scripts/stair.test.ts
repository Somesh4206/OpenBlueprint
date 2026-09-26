import { describe, expect, test } from 'bun:test';
import { checkStair, reserveStair, sizeStair } from '../src/lib/layout/stair';
import type { LayoutData, RoomRect, StairCore } from '../src/lib/types';

const plot = {
  width: 30, length: 40, unit: 'ft' as const, roadSide: 'north' as const,
  northDirection: 0, setbackFront: 5, setbackRear: 3, setbackSides: 3,
};
const room = (type: RoomRect['type'], name: string, x: number, y: number, width: number, length: number, floor: number): RoomRect => ({
  id: `${name}-${floor}`, type, name, x, y, width, length, floor, doors: [], windows: [],
});
const layout = (floors: number, rooms: RoomRect[], stair?: StairCore): LayoutData => ({
  plot, floors, rooms, furniture: [], stair,
});
// Core at x 3..10, y 9..19. Access rooms sit directly in front (y 3..9).
const core: StairCore = { x: 3, y: 9, width: 7, length: 10, kind: 'dog-leg' };

describe('sizeStair', () => {
  test('wide footprint gets a 7x10 dog-leg', () => {
    expect(sizeStair({ x: 3, y: 3, w: 24, h: 32 })).toEqual({ width: 7, length: 10, kind: 'dog-leg' });
  });
  test('narrow footprint gets a 3.5x13 straight flight', () => {
    expect(sizeStair({ x: 3, y: 3, w: 12, h: 30 })).toEqual({ width: 3.5, length: 13, kind: 'straight' });
  });
  test('too narrow for any flight returns null', () => {
    expect(sizeStair({ x: 0, y: 0, w: 3, h: 30 })).toBeNull();
  });
});

describe('reserveStair', () => {
  const fp = { x: 3, y: 3, w: 24, h: 32 };
  test('left, center and right slots differ in x', () => {
    expect(reserveStair(fp, 'left', 6, false)?.x).toBe(3);
    expect(reserveStair(fp, 'center', 6, false)?.x).toBe(11.5);
    expect(reserveStair(fp, 'right', 6, false)?.x).toBe(20);
  });
  test('front offset is measured from the road edge', () => {
    expect(reserveStair(fp, 'left', 6, false)?.y).toBe(9);
    expect(reserveStair(fp, 'left', 6, true)?.y).toBe(19);
  });
  test('returns null when the flight would leave the footprint', () => {
    expect(reserveStair(fp, 'left', 25, false)).toBeNull();
  });
});

describe('checkStair', () => {
  test('single-floor plan never raises stair issues', () => {
    expect(checkStair(layout(1, [room('living', 'Living', 3, 3, 24, 32, 0)]))).toEqual([]);
  });
  test('2-floor plan with foyer below and lobby above passes', () => {
    const rooms = [
      room('foyer', 'Foyer', 3, 3, 10, 6, 0),
      room('foyer', 'Upper Lobby', 3, 3, 10, 6, 1),
    ];
    expect(checkStair(layout(2, rooms, core))).toEqual([]);
  });
  test('upper floor reachable only from a bedroom is bad access', () => {
    const rooms = [
      room('foyer', 'Foyer', 3, 3, 10, 6, 0),
      room('bedroom', 'Bedroom 1', 3, 3, 10, 6, 1),
    ];
    expect(checkStair(layout(2, rooms, core)).map((i) => i.code)).toEqual(['STAIR_BAD_ACCESS']);
  });
  test('a room covering the core is blocked', () => {
    const rooms = [
      room('foyer', 'Foyer', 3, 3, 10, 6, 0),
      room('foyer', 'Upper Lobby', 3, 3, 10, 6, 1),
      room('bedroom', 'Bedroom 1', 3, 9, 12, 12, 1),
    ];
    expect(checkStair(layout(2, rooms, core)).map((i) => i.code)).toContain('STAIR_BLOCKED');
  });
  test('an undersized flight is too small', () => {
    const rooms = [
      room('foyer', 'Foyer', 3, 3, 10, 6, 0),
      room('foyer', 'Upper Lobby', 3, 3, 10, 6, 1),
    ];
    const tiny: StairCore = { ...core, width: 4, length: 7 };
    expect(checkStair(layout(2, rooms, tiny)).map((i) => i.code)).toContain('STAIR_TOO_SMALL');
  });
  test('core outside a floor footprint is misaligned', () => {
    const rooms = [
      room('foyer', 'Foyer', 3, 3, 10, 6, 0),
      room('foyer', 'Upper Lobby', 3, 3, 10, 6, 1),
    ];
    const footprints = [{ x: 3, y: 3, w: 24, h: 32 }, { x: 12, y: 3, w: 15, h: 32 }];
    expect(checkStair(layout(2, rooms, core), footprints).map((i) => i.code)).toContain('STAIR_MISALIGNED');
  });
  test('multi-floor plan without a core or legacy stair is missing', () => {
    expect(checkStair(layout(2, [room('foyer', 'Foyer', 3, 3, 10, 6, 0)])).map((i) => i.code)).toEqual(['STAIR_MISSING']);
  });
});
