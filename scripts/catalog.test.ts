import { describe, expect, test } from 'bun:test';
import { ROOM_CATALOG } from '../src/lib/room-catalog';
import type { RoomType } from '../src/lib/types';

describe('room catalog sizing', () => {
  test('sizing matches spec', () => {
    const fixed: RoomType[] = ['bathroom', 'store', 'pooja', 'utility', 'parking', 'foyer', 'office', 'balcony'];
    const flex: RoomType[] = ['living', 'bedroom', 'dining', 'kitchen'];
    for (const t of fixed) expect(`${t}:${ROOM_CATALOG[t].sizing}`).toBe(`${t}:fixed`);
    for (const t of flex) expect(`${t}:${ROOM_CATALOG[t].sizing}`).toBe(`${t}:flex`);
  });
});
