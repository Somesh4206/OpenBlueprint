import { describe, expect, test } from 'bun:test';
import { ROOM_CATALOG } from '../src/lib/room-catalog';

describe('caps config', () => {
  test('bedroom cap is 180 sqft / 1.6 aspect', () => {
    expect(ROOM_CATALOG.bedroom.maxArea).toBe(180);
    expect(ROOM_CATALOG.bedroom.maxAspect).toBe(1.6);
  });
  test('bathroom cap is 80 sqft / 2.0 aspect', () => {
    expect(ROOM_CATALOG.bathroom.maxArea).toBe(80);
    expect(ROOM_CATALOG.bathroom.maxAspect).toBe(2.0);
  });
  test('kitchen cap is 150 sqft / 1.6 aspect', () => {
    expect(ROOM_CATALOG.kitchen.maxArea).toBe(150);
    expect(ROOM_CATALOG.kitchen.maxAspect).toBe(1.6);
  });
  test('living cap is 260 sqft / 1.8 aspect', () => {
    expect(ROOM_CATALOG.living.maxArea).toBe(260);
    expect(ROOM_CATALOG.living.maxAspect).toBe(1.8);
  });
});
