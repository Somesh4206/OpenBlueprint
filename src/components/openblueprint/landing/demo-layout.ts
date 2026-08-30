import { LayoutData } from '@/lib/types';

/**
 * Demo 30×40 ft 2-BHK floor plan used in the hero "2D Plan" preview.
 * Layout:
 *   - Master Bedroom  : 14 × 14 ft (rear-left)
 *   - Bedroom 2       : 15 × 12 ft (middle-left)
 *   - Bathroom        :  8 ×  8 ft (rear-right)
 *   - Kitchen         : 15 × 12 ft (middle-right)
 *   - Living Room     : 20 × 14 ft (front-left)
 *   - Parking         : 10 × 20 ft (front-right)
 * Road on south (front, high Y), north arrow up.
 */
export const demoLayout: LayoutData = {
  plot: {
    width: 30,
    length: 40,
    unit: 'ft',
    roadSide: 'south',
    northDirection: 0,
    setbackFront: 0,
    setbackRear: 0,
    setbackSides: 0,
  },
  floors: 1,
  strategy: 'modern-open',
  rooms: [
    {
      id: 'r-master',
      type: 'bedroom',
      name: 'Master Bedroom',
      x: 0,
      y: 0,
      width: 14,
      length: 14,
      floor: 0,
      doors: [{ wall: 'bottom', pos: 0.5, width: 3 }],
      windows: [
        { wall: 'left', pos: 0.5, width: 4 },
        { wall: 'top', pos: 0.5, width: 5 },
      ],
    },
    {
      id: 'r-bath',
      type: 'bathroom',
      name: 'Bathroom',
      x: 14,
      y: 0,
      width: 8,
      length: 8,
      floor: 0,
      doors: [{ wall: 'bottom', pos: 0.5, width: 2.5 }],
      windows: [{ wall: 'top', pos: 0.5, width: 2 }],
    },
    {
      id: 'r-bed2',
      type: 'bedroom',
      name: 'Bedroom 2',
      x: 0,
      y: 14,
      width: 15,
      length: 12,
      floor: 0,
      doors: [{ wall: 'right', pos: 0.5, width: 3 }],
      windows: [{ wall: 'left', pos: 0.5, width: 4 }],
    },
    {
      id: 'r-kit',
      type: 'kitchen',
      name: 'Kitchen',
      x: 15,
      y: 8,
      width: 15,
      length: 12,
      floor: 0,
      doors: [{ wall: 'bottom', pos: 0.3, width: 3 }],
      windows: [{ wall: 'right', pos: 0.5, width: 4 }],
    },
    {
      id: 'r-living',
      type: 'living',
      name: 'Living Room',
      x: 0,
      y: 26,
      width: 20,
      length: 14,
      floor: 0,
      doors: [{ wall: 'top', pos: 0.5, width: 3.5 }],
      windows: [
        { wall: 'left', pos: 0.5, width: 5 },
        { wall: 'bottom', pos: 0.4, width: 6 },
      ],
    },
    {
      id: 'r-park',
      type: 'parking',
      name: 'Parking',
      x: 20,
      y: 20,
      width: 10,
      length: 20,
      floor: 0,
      doors: [],
      windows: [],
    },
  ],
};
