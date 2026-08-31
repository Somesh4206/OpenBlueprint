// OpenBlueprint core type system — single source of truth

export type Unit = 'ft' | 'm';

export type RoomType =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'living'
  | 'dining'
  | 'parking'
  | 'balcony'
  | 'pooja'
  | 'office'
  | 'utility'
  | 'staircase'
  | 'foyer'
  | 'store';

export interface RoomRect {
  id: string;
  type: RoomType;
  name: string;
  x: number; // in plot units (ft or m)
  y: number;
  width: number;
  length: number;
  floor: number; // 0-indexed floor number
  // doors as wall-segment markers (normalized 0..1 along the wall)
  doors: DoorMarker[];
  windows: WindowMarker[];
}

// ---- Furniture ----
export type FurnitureType =
  | 'bed-single' | 'bed-double' | 'bed-king'
  | 'sofa-2' | 'sofa-3' | 'sofa-l' | 'armchair'
  | 'chair-dining' | 'chair-office' | 'bar-stool'
  | 'table-round' | 'table-rect' | 'table-coffee' | 'table-dining-6'
  | 'desk'
  | 'wardrobe' | 'bookshelf' | 'shelf-wall'
  | 'tv-unit' | 'tv-wall'
  | 'kitchen-counter' | 'kitchen-island' | 'stove' | 'sink-kitchen' | 'fridge'
  | 'toilet' | 'bathtub' | 'shower' | 'vanity' | 'washer'
  | 'plant-small' | 'plant-large'
  | 'rug' | 'lamp-floor' | 'pooja-altar'
  | 'dining-set-4' | 'dining-set-6'
  | 'reception-desk' | 'meeting-table' | 'office-cabin'
  | 'clothing-rack' | 'display-shelf' | 'service-counter'
  | 'car' | 'bike';

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  name: string;
  x: number; // top-left in plot units (ft), relative to plot origin
  y: number;
  width: number; // bounding box width (ft) — before rotation
  length: number; // bounding box length (ft)
  rotation: number; // 0 | 90 | 180 | 270
  floor: number;
  color?: string;
}

export type FurnitureCategory =
  | 'bedroom'
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'storage'
  | 'decor'
  | 'commercial';

export interface FurnitureCatalogEntry {
  type: FurnitureType;
  name: string;
  category: FurnitureCategory;
  width: number; // ft
  length: number; // ft
  color: string;
  // room types where this furniture is commonly suggested
  roomTypes?: RoomType[];
  price?: number; // optional INR for display
}

export interface DoorMarker {
  wall: 'top' | 'right' | 'bottom' | 'left';
  pos: number; // 0..1 along the wall
  width: number; // in units (e.g. 3ft)
}

export interface WindowMarker {
  wall: 'top' | 'right' | 'bottom' | 'left';
  pos: number; // 0..1 along the wall
  width: number; // in units
}

export interface PlotConfig {
  width: number;
  length: number;
  unit: Unit;
  roadSide: 'north' | 'south' | 'east' | 'west';
  northDirection: number; // degrees, 0 = up
  setbackFront: number;
  setbackRear: number;
  setbackSides: number;
}

export interface RoomRequirement {
  type: RoomType;
  name: string;
  count: number;
  minWidth: number;
  minLength: number;
  preferredWidth: number;
  preferredLength: number;
  priority: 'high' | 'medium' | 'low';
  attachedTo?: RoomType | null;
  preferredLocation?: 'front' | 'rear' | 'side' | 'center' | null;
}

export interface ProjectConfig {
  plot: PlotConfig;
  floors: number;
  rooms: RoomRequirement[];
  style: DesignStyle;
  preferences: PreferenceKey[];
  vastuEnabled: boolean;
  vastu: VastuPrefs;
  // Human-in-the-loop floor assignment: maps room type → array of counts per floor.
  // e.g. { bedroom: [1, 2] } = 1 bedroom on ground, 2 on first.
  // If absent, the engine distributes automatically.
  floorAssignment?: Record<string, number[]>;
}

export type DesignStyle =
  | 'modern'
  | 'traditional'
  | 'minimal'
  | 'contemporary'
  | 'luxury';

export type PreferenceKey =
  | 'kitchen-near-dining'
  | 'master-attached-bath'
  | 'parking-near-entrance'
  | 'internal-staircase'
  | 'balcony-bedroom'
  | 'max-natural-light'
  | 'improved-circulation'
  | 'open-plan';

export interface VastuPrefs {
  entrance: 'north' | 'east' | 'south' | 'west' | null;
  kitchen: 'southeast' | 'northwest' | null;
  bedroom: 'southwest' | 'south' | null;
  pooja: 'northeast' | 'center-east' | null;
}

export interface LayoutData {
  plot: PlotConfig;
  floors: number;
  rooms: RoomRect[];
  furniture: FurnitureItem[];
  strategy: LayoutStrategy;
}

export type LayoutStrategy =
  | 'space-optimized'
  | 'ventilation-optimized'
  | 'modern-open'
  | 'privacy-optimized'
  | 'vastu-optimized';

export interface LayoutScore {
  total: number; // 0..100
  spaceUtilization: number;
  circulation: number;
  ventilation: number;
  requirementMatch: number;
  dimensionValidity: number;
  simplicity: number;
}

export interface ScoredLayout {
  id: string;
  name: string;
  strategy: LayoutStrategy;
  tagline: string;
  layout: LayoutData;
  score: LayoutScore;
  builtUpArea: number;
  roomCount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  geometry: { ok: boolean; notes: string[] };
  accessibility: { ok: boolean; notes: string[] };
  spacePlanning: { ok: boolean; notes: string[] };
  requirements: { ok: boolean; notes: string[] };
}

export interface ValidationIssue {
  code: string;
  message: string;
  roomId?: string;
  roomName?: string;
  severity: 'error' | 'warning';
}

export interface DesignInsight {
  kind: 'positive' | 'warning' | 'suggestion';
  title: string;
  detail: string;
}

export type MaterialFloor = 'ceramic' | 'vitrified' | 'marble' | 'wood';
export type MaterialDoor = 'wood' | 'engineered' | 'panel';
export type MaterialWindow = 'aluminium' | 'upvc' | 'wood';
export type FinishGrade = 'basic' | 'standard' | 'premium' | 'luxury';

export interface MaterialSelection {
  flooring: MaterialFloor;
  doors: MaterialDoor;
  windows: MaterialWindow;
  finish: FinishGrade;
}

export interface CostBreakdown {
  foundation: number;
  structure: number;
  flooring: number;
  electrical: number;
  plumbing: number;
  doorsWindows: number;
  painting: number;
  other: number;
}

export interface CostEstimate {
  area: number; // sq.ft
  grade: FinishGrade;
  ratePerSqft: number; // INR
  total: number; // INR
  breakdown: CostBreakdown;
  currency: 'INR';
}

// AI assistant
export interface AiAction {
  type: 'resize-room' | 'move-room' | 'add-room' | 'remove-room' | 'rename-room' | 'rearrange' | 'note';
  description: string;
  roomType?: RoomType;
  roomName?: string;
  // deltas
  deltaW?: number;
  deltaL?: number;
  targetLocation?: 'front' | 'rear' | 'side' | 'center' | 'open' | 'privacy' | 'ventilation' | 'compact' | 'space' | 'sw' | 'se' | 'ne' | 'nw' | 'vastu';
  targetRoomType?: RoomType;
  newName?: string;
}

export interface AiAssistantResponse {
  understood: string;
  actions: AiAction[];
  explanation: string;
  appliedLayout?: LayoutData;
}

export interface KnowledgeAnswer {
  question: string;
  answer: string;
  sources: string[];
}

export interface ProjectTemplate {
  id: string;
  category: 'residential' | 'commercial' | 'other';
  name: string;
  description: string;
  plot: PlotConfig;
  floors: number;
  rooms: RoomRequirement[];
  style: DesignStyle;
  preview: { type: RoomType; w: number; l: number }[];
}

export type AppView =
  | { name: 'landing' }
  | { name: 'dashboard' }
  | { name: 'wizard' }
  | { name: 'design-options'; config: ProjectConfig; designs: ScoredLayout[] }
  | { name: 'workspace'; projectId: string | null; config: ProjectConfig; design: ScoredLayout };
