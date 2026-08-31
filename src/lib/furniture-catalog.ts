import { FurnitureCatalogEntry, FurnitureType, RoomType } from './types';

// Comprehensive furniture library — each entry has 2D symbol + 3D spec
export const FURNITURE_CATALOG: FurnitureCatalogEntry[] = [
  // ---- Bedroom ----
  { type: 'bed-single', name: 'Single Bed', category: 'bedroom', width: 3, length: 6.5, color: '#c9d6e8', roomTypes: ['bedroom'], price: 12000 },
  { type: 'bed-double', name: 'Double Bed', category: 'bedroom', width: 5, length: 6.5, color: '#c9d6e8', roomTypes: ['bedroom'], price: 22000 },
  { type: 'bed-king', name: 'King Bed', category: 'bedroom', width: 6, length: 7, color: '#c9d6e8', roomTypes: ['bedroom'], price: 35000 },
  { type: 'wardrobe', name: 'Wardrobe', category: 'bedroom', width: 6, length: 2, color: '#b8a890', roomTypes: ['bedroom'], price: 28000 },
  { type: 'pooja-altar', name: 'Pooja Altar', category: 'bedroom', width: 3, length: 1.5, color: '#d4a574', roomTypes: ['pooja', 'living'], price: 15000 },

  // ---- Living ----
  { type: 'sofa-3', name: '3-Seater Sofa', category: 'living', width: 7, length: 3, color: '#8a9bb0', roomTypes: ['living'], price: 32000 },
  { type: 'sofa-2', name: '2-Seater Sofa', category: 'living', width: 5, length: 3, color: '#8a9bb0', roomTypes: ['living'], price: 24000 },
  { type: 'sofa-l', name: 'L-Shape Sofa', category: 'living', width: 8, length: 8, color: '#8a9bb0', roomTypes: ['living'], price: 48000 },
  { type: 'armchair', name: 'Armchair', category: 'living', width: 3, length: 3, color: '#9b7e6a', roomTypes: ['living', 'bedroom'], price: 12000 },
  { type: 'table-coffee', name: 'Coffee Table', category: 'living', width: 4, length: 2, color: '#a8896a', roomTypes: ['living'], price: 8500 },
  { type: 'tv-unit', name: 'TV Unit', category: 'living', width: 5, length: 1.5, color: '#6b5d4f', roomTypes: ['living', 'bedroom'], price: 18000 },
  { type: 'tv-wall', name: 'Wall TV', category: 'living', width: 4, length: 0.5, color: '#1a1a1a', roomTypes: ['living', 'bedroom'], price: 45000 },

  // ---- Dining ----
  { type: 'table-dining-6', name: 'Dining Table (6)', category: 'dining', width: 5, length: 3, color: '#a8896a', roomTypes: ['dining'], price: 26000 },
  { type: 'table-round', name: 'Round Table', category: 'dining', width: 4, length: 4, color: '#a8896a', roomTypes: ['dining'], price: 18000 },
  { type: 'table-rect', name: 'Rectangle Table', category: 'dining', width: 6, length: 3, color: '#a8896a', roomTypes: ['dining', 'office'], price: 22000 },
  { type: 'chair-dining', name: 'Dining Chair', category: 'dining', width: 1.5, length: 1.5, color: '#5a4a3a', roomTypes: ['dining'], price: 3500 },
  { type: 'dining-set-4', name: 'Dining Set (4)', category: 'dining', width: 5, length: 5, color: '#a8896a', roomTypes: ['dining'], price: 38000 },
  { type: 'dining-set-6', name: 'Dining Set (6)', category: 'dining', width: 6, length: 5, color: '#a8896a', roomTypes: ['dining'], price: 52000 },
  { type: 'bar-stool', name: 'Bar Stool', category: 'dining', width: 1.5, length: 1.5, color: '#3a3a3a', roomTypes: ['dining', 'kitchen'], price: 4200 },

  // ---- Kitchen ----
  { type: 'kitchen-counter', name: 'Kitchen Counter', category: 'kitchen', width: 8, length: 2, color: '#9ab0c4', roomTypes: ['kitchen'], price: 45000 },
  { type: 'kitchen-island', name: 'Kitchen Island', category: 'kitchen', width: 4, length: 3, color: '#9ab0c4', roomTypes: ['kitchen'], price: 32000 },
  { type: 'stove', name: 'Stove', category: 'kitchen', width: 3, length: 2, color: '#2a2a2a', roomTypes: ['kitchen'], price: 18000 },
  { type: 'sink-kitchen', name: 'Kitchen Sink', category: 'kitchen', width: 2.5, length: 1.5, color: '#b8c8d8', roomTypes: ['kitchen'], price: 8500 },
  { type: 'fridge', name: 'Refrigerator', category: 'kitchen', width: 3, length: 2.5, color: '#e0e4e8', roomTypes: ['kitchen'], price: 38000 },

  // ---- Bathroom ----
  { type: 'toilet', name: 'Toilet', category: 'bathroom', width: 2, length: 3, color: '#e8e8e8', roomTypes: ['bathroom'], price: 12000 },
  { type: 'bathtub', name: 'Bathtub', category: 'bathroom', width: 5, length: 2.5, color: '#e8e8e8', roomTypes: ['bathroom'], price: 28000 },
  { type: 'shower', name: 'Shower', category: 'bathroom', width: 3, length: 3, color: '#c8d8e8', roomTypes: ['bathroom'], price: 15000 },
  { type: 'vanity', name: 'Vanity Sink', category: 'bathroom', width: 3, length: 1.5, color: '#e8e8e8', roomTypes: ['bathroom'], price: 14000 },
  { type: 'washer', name: 'Washing Machine', category: 'bathroom', width: 2.5, length: 2.5, color: '#e0e4e8', roomTypes: ['utility', 'bathroom'], price: 22000 },

  // ---- Office ----
  { type: 'desk', name: 'Office Desk', category: 'office', width: 5, length: 2.5, color: '#8a6a4a', roomTypes: ['office'], price: 16000 },
  { type: 'chair-office', name: 'Office Chair', category: 'office', width: 2, length: 2, color: '#2a2a2a', roomTypes: ['office'], price: 8500 },
  { type: 'bookshelf', name: 'Bookshelf', category: 'office', width: 4, length: 1, color: '#8a6a4a', roomTypes: ['office', 'living'], price: 12000 },
  { type: 'meeting-table', name: 'Meeting Table', category: 'office', width: 6, length: 4, color: '#8a6a4a', roomTypes: ['office', 'living'], price: 28000 },
  { type: 'office-cabin', name: 'Office Cabin', category: 'office', width: 6, length: 5, color: '#9ab0c4', roomTypes: ['office'], price: 35000 },

  // ---- Storage ----
  { type: 'shelf-wall', name: 'Wall Shelf', category: 'storage', width: 4, length: 1, color: '#b8a890', roomTypes: ['living', 'store', 'office'], price: 6500 },
  { type: 'clothing-rack', name: 'Clothing Rack', category: 'storage', width: 4, length: 2, color: '#5a5a5a', roomTypes: ['store', 'bedroom'], price: 8500 },
  { type: 'display-shelf', name: 'Display Shelf', category: 'storage', width: 6, length: 1.5, color: '#6b5d4f', roomTypes: ['living', 'store'], price: 14000 },

  // ---- Decor ----
  { type: 'plant-small', name: 'Small Plant', category: 'decor', width: 1.5, length: 1.5, color: '#4a7a3a', roomTypes: ['living', 'bedroom', 'office', 'dining'], price: 1200 },
  { type: 'plant-large', name: 'Large Plant', category: 'decor', width: 3, length: 3, color: '#3a6a2a', roomTypes: ['living', 'office', 'dining'], price: 3500 },
  { type: 'rug', name: 'Area Rug', category: 'decor', width: 6, length: 4, color: '#a85a3a', roomTypes: ['living', 'bedroom'], price: 9500 },
  { type: 'lamp-floor', name: 'Floor Lamp', category: 'decor', width: 1, length: 1, color: '#d4a574', roomTypes: ['living', 'bedroom', 'office'], price: 4500 },

  // ---- Commercial ----
  { type: 'reception-desk', name: 'Reception Desk', category: 'commercial', width: 8, length: 3, color: '#8a6a4a', roomTypes: ['living', 'office'], price: 42000 },
  { type: 'service-counter', name: 'Service Counter', category: 'commercial', width: 6, length: 2.5, color: '#6b5d4f', roomTypes: ['kitchen', 'store'], price: 28000 },
];

export const FURNITURE_MAP: Record<FurnitureType, FurnitureCatalogEntry> = FURNITURE_CATALOG.reduce(
  (acc, f) => { acc[f.type] = f; return acc; },
  {} as Record<FurnitureType, FurnitureCatalogEntry>,
);

export const FURNITURE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'living', label: 'Living' },
  { key: 'dining', label: 'Dining' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'bathroom', label: 'Bathroom' },
  { key: 'office', label: 'Office' },
  { key: 'storage', label: 'Storage' },
  { key: 'decor', label: 'Decor' },
  { key: 'commercial', label: 'Commercial' },
];

export function furnitureByCategory(cat: string): FurnitureCatalogEntry[] {
  return FURNITURE_CATALOG.filter((f) => f.category === cat);
}

export function suggestedFurniture(roomType: RoomType): FurnitureCatalogEntry[] {
  return FURNITURE_CATALOG.filter((f) => f.roomTypes?.includes(roomType));
}
