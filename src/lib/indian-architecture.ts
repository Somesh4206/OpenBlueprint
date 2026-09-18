// Indian residential architecture knowledge base
// Researched from Vastu Shastra principles, common Indian floor plan practices,
// and typical construction norms for Indian plots (30×40, 40×60, etc.)

export interface IndianRoomNorm {
  type: string;
  label: string;
  // Typical Indian residential sizes (feet)
  minSize: [number, number];
  preferredSize: [number, number];
  // Vastu-preferred direction (cultural preference, NOT structural)
  vastuDirection?: string;
  vastuNotes?: string;
  notes: string;
}

export const INDIAN_ROOM_NORMS: Record<string, IndianRoomNorm> = {
  bedroom: {
    type: 'bedroom',
    label: 'Bedroom',
    minSize: [10, 12],
    preferredSize: [12, 14],
    vastuDirection: 'South-West',
    vastuNotes: 'Master bedroom in SW brings stability and prosperity. Avoid bedroom in NE.',
    notes: 'Master bedroom is the largest, typically 12×14 to 14×16. Attached bathroom preferred. Place bed with head toward south or east.',
  },
  'master-bedroom': {
    type: 'master-bedroom',
    label: 'Master Bedroom',
    minSize: [12, 14],
    preferredSize: [14, 16],
    vastuDirection: 'South-West',
    vastuNotes: 'Master bedroom in SW is the most important Vastu principle for a home.',
    notes: 'Largest bedroom, usually with attached bathroom and wardrobe. 14×16 ft is comfortable for king bed + wardrobe + study.',
  },
  kitchen: {
    type: 'kitchen',
    label: 'Kitchen',
    minSize: [8, 8],
    preferredSize: [10, 10],
    vastuDirection: 'South-East',
    vastuNotes: 'SE is Agni (fire) corner — ideal for kitchen. NW is second choice. Avoid NE and SW.',
    notes: 'L-shape or parallel counter layout. Hob on SE, sink on NE corner of counter. Minimum 8×8; 10×10 with island is modern preference. Provide window for ventilation.',
  },
  'living-room': {
    type: 'living-room',
    label: 'Living Room',
    minSize: [12, 14],
    preferredSize: [14, 16],
    vastuDirection: 'North-East or North',
    vastuNotes: 'Living in NE/ North invites positivity. Entrance from North or East is auspicious.',
    notes: 'Front-facing room near entrance for guest reception. 14×16 ft seats 6-8. Connect to dining. Large window on road side.',
  },
  dining: {
    type: 'dining',
    label: 'Dining',
    minSize: [8, 10],
    preferredSize: [10, 12],
    vastuDirection: 'East',
    vastuNotes: 'Dining in East or adjacent to kitchen supports digestion and family bonding.',
    notes: 'Adjacent to kitchen for serving. 10×12 ft fits 6-seater table with circulation. Open-plan with living is common in modern homes.',
  },
  bathroom: {
    type: 'bathroom',
    label: 'Bathroom',
    minSize: [5, 7],
    preferredSize: [7, 8],
    vastuDirection: 'North-West or West',
    vastuNotes: 'Bathrooms in NW or W. Avoid NE (sacred) and SW (stability).',
    notes: 'Attached to bedrooms where possible. 7×8 ft fits WC, shower, and vanity. Provide exhaust fan and window to outside.',
  },
  pooja: {
    type: 'pooja',
    label: 'Pooja Room',
    minSize: [4, 4],
    preferredSize: [5, 6],
    vastuDirection: 'North-East',
    vastuNotes: 'NE (Ishan) is the most sacred corner — ideal for pooja. Face east or north while praying.',
    notes: 'Small, quiet room in NE corner. 5×6 ft is comfortable. Avoid placing deities facing south.',
  },
  parking: {
    type: 'parking',
    label: 'Parking',
    minSize: [9, 18],
    preferredSize: [10, 20],
    vastuDirection: 'North-West or South-East',
    vastuNotes: 'Parking in NW or SE. Avoid NE.',
    notes: 'One car needs 9×18 ft (162 sqft); two cars need 18×18. Provide 9 ft gate opening. Covered porch common. Bike parking 4×6 ft corner.',
  },
  staircase: {
    type: 'staircase',
    label: 'Staircase',
    minSize: [6, 10],
    preferredSize: [7, 12],
    vastuDirection: 'South, West, or South-West',
    vastuNotes: 'Stairs in S, W, or SW. Clockwise ascent is preferred. Avoid center (Brahmasthan) and NE.',
    notes: 'Internal staircase saves space. 3 ft wide minimum, 3.5 ft preferred. 10-12 steps per flight, 7" riser, 11" tread.',
  },
  balcony: {
    type: 'balcony',
    label: 'Balcony',
    minSize: [4, 6],
    preferredSize: [5, 8],
    vastuDirection: 'North, East, or North-East',
    vastuNotes: 'Balconies in N, E, or NE for morning sun. Avoid SW balconies.',
    notes: 'Off bedrooms or living. 5×8 ft fits 2 chairs. RCC or steel railing, 3.5 ft high.',
  },
  office: {
    type: 'office',
    label: 'Home Office',
    minSize: [8, 8],
    preferredSize: [10, 10],
    vastuDirection: 'West or South-West',
    vastuNotes: 'Work area in W or SW improves concentration.',
    notes: 'Quiet corner, 10×10 ft for desk + bookshelf + chair. Window for natural light. Post-COVID essential room.',
  },
  utility: {
    type: 'utility',
    label: 'Utility',
    minSize: [5, 6],
    preferredSize: [6, 8],
    vastuDirection: 'North-West',
    vastuNotes: 'Utility/wash area in NW.',
    notes: 'Washing machine, drying, and wash sink. Off kitchen or rear. 6×8 ft typical.',
  },
  foyer: {
    type: 'foyer',
    label: 'Foyer',
    minSize: [5, 5],
    preferredSize: [6, 6],
    vastuDirection: 'East or North',
    vastuNotes: 'Entry foyer in E or N. Main door should be the largest in the house.',
    notes: 'Small transition space at entry, 6×6 ft. Shoe rack + key holder.',
  },
  store: {
    type: 'store',
    label: 'Store Room',
    minSize: [4, 4],
    preferredSize: [5, 6],
    vastuDirection: 'South or West',
    vastuNotes: 'Store in S or W (heavy storage). Avoid NE.',
    notes: 'General storage, 5×6 ft. Off kitchen or rear passage.',
  },
};

// Vastu direction → quadrant mapping (cultural preference)
export const VASTU_QUADRANTS = {
  NE: { label: 'North-East', x: [0, 0.5], y: [0, 0.5] }, // sacred, pooja, entrance
  NW: { label: 'North-West', x: [0, 0.5], y: [0.5, 1] }, // parking, bathroom
  SE: { label: 'South-East', x: [0.5, 1], y: [0, 0.5] }, // kitchen (Agni)
  SW: { label: 'South-West', x: [0.5, 1], y: [0.5, 1] }, // master bedroom, staircase
  N: { label: 'North', x: [0, 1], y: [0, 0.3] }, // entrance, living
  E: { label: 'East', x: [0.7, 1], y: [0, 1] }, // entrance
  S: { label: 'South', x: [0, 1], y: [0.7, 1] }, // heavy rooms
  W: { label: 'West', x: [0, 0.3], y: [0, 1] }, // offices, storage
};

// Standard Indian plot templates with setbacks
export interface IndianPlotTemplate {
  name: string;
  width: number;
  length: number;
  floors: number;
  description: string;
  commonConfig: string;
}

export const INDIAN_PLOT_TEMPLATES: IndianPlotTemplate[] = [
  { name: '30×40', width: 30, length: 40, floors: 2, description: '1200 sqft plot, G+1, common in urban India', commonConfig: '2BHK ground + 1BHK first, or 3BHK duplex' },
  { name: '30×50', width: 30, length: 50, floors: 2, description: '1500 sqft, G+1, spacious 3BHK', commonConfig: '3BHK with parking + garden' },
  { name: '40×60', width: 40, length: 60, floors: 2, description: '2400 sqft, G+1, premium 4BHK', commonConfig: '4BHK villa with duplex' },
  { name: '20×30', width: 20, length: 30, floors: 2, description: '600 sqft, compact urban plot', commonConfig: '1BHK or compact 2BHK' },
  { name: '25×40', width: 25, length: 40, floors: 2, description: '1000 sqft, narrow plot', commonConfig: '2BHK with parking' },
  { name: '50×80', width: 50, length: 80, floors: 3, description: '4000 sqft, large villa', commonConfig: 'Luxury 5BHK villa' },
];

// Typical Indian construction cost (₹ per sqft, 2024)
export const INDIAN_COST_RATES = {
  basic: { min: 850, max: 1400, label: 'Basic' },
  standard: { min: 1150, max: 1900, label: 'Standard' },
  premium: { min: 1700, max: 2800, label: 'Premium' },
  luxury: { min: 2500, max: 4000, label: 'Luxury' },
};

// Indian construction cost breakdown (percentages)
export const INDIAN_COST_BREAKDOWN = {
  foundation: 0.1,
  structure: 0.27, // RCC frame, slabs, columns
  masonry: 0.08, // brick/block walls
  plastering: 0.05,
  flooring: 0.1,
  electrical: 0.08,
  plumbing: 0.07,
  doorsWindows: 0.1,
  painting: 0.07,
  kitchen: 0.03, // modular kitchen
  bathroom: 0.03, // bath fittings
  other: 0.02,
};

// Vastu entrance direction preferences
export const VASTU_ENTRANCE = {
  East: 'Most auspicious — morning sun, prosperity',
  North: 'Very auspicious — wealth, opportunity',
  NorthEast: 'Auspicious — sacred direction',
  South: 'Acceptable with care — place heavy items in SW',
  West: 'Acceptable — good for business',
  SouthWest: 'Avoid — entry here brings negative energy',
  SouthEast: 'Avoid — fire direction, causes conflict',
  NorthWest: 'Acceptable — good for guest houses',
};

// Indian zoning rules summary (general — verify locally)
export const INDIAN_ZONING_NOTES = [
  'Setbacks: typical 10% front, 5% rear, 3% sides for 30×40 plots (varies by city).',
  'FSI/FAR: typically 1.5-2.0 for residential in most Indian cities (Bangalore 1.5-2.5, Chennai 2, Delhi 2).',
  'Height limit: usually 10-12m for G+2 residential.',
  'Parking: most cities mandate 1 covered car parking per dwelling unit.',
  'Staircase: minimum 1m wide, fire escape required for 3+ floors.',
  'Septic tank + soak pit required where no sewer connection.',
  'Rainwater harvesting mandatory in many cities (Chennai, Bangalore).',
  'Solar-ready roof encouraged; solar water heating mandatory in some cities.',
];

// AI context prompt: inject this into the LLM system prompt for design assistant
// and into the layout generator's strategy decisions.
export const INDIAN_ARCHITECTURE_CONTEXT = `INDIAN RESIDENTIAL ARCHITECTURE CONTEXT:
You are designing for an Indian residential plot. Apply these principles:

PLOT & SETBACKS:
- Common plots: 30×40 (1200 sqft), 30×50 (1500), 40×60 (2400), 20×30 (600).
- Typical setbacks: front 3-5 ft (or 10% of depth), rear 3 ft, sides 3 ft each. Varies by city.
- FSI 1.5-2.0 typical → G+1 or G+2 on standard plots.
- Parking (1 car + 1 bike) is MANDATORY in most cities — place at front near road.

ROOM SIZING (Indian norms, feet):
- Master Bedroom: 12×14 to 14×16 (largest, SW corner)
- Bedroom: 10×12 minimum, 11×13 preferred
- Living Room: 14×16 (front, near entrance, road-side window)
- Kitchen: 10×10 (L-shape or parallel counter, SE corner)
- Dining: 10×12 (adjacent to kitchen, open-plan with living)
- Bathroom: 7×8 (attached to bedrooms where possible)
- Pooja Room: 5×6 (NE corner, sacred)
- Staircase: 7×12 (internal, S/W/SW, clockwise ascent)
- Parking: 10×20 (covered porch, front, NW or SE)
- Balcony: 5×8 (off bedroom, N/E/NE)
- Utility: 6×8 (NW, washing machine + wash)

VASTU SHASTRA (cultural preferences, NOT structural requirements):
- Entrance: East or North most auspicious.
- Kitchen: South-East (Agni/fire corner) preferred; NW second choice.
- Master Bedroom: South-West (stability, prosperity).
- Pooja Room: North-East (Ishan, sacred corner).
- Bathroom: NW or West; avoid NE and SW.
- Staircase: South, West, or SW; clockwise ascent; avoid center (Brahmasthan) and NE.
- Living/Entrance foyer: NE or North.
- Parking: NW or SE; avoid NE.

LAYOUT PRINCIPLES:
- Ground floor: parking + living + kitchen + dining + 1 bedroom (for elders) + 1 bath + staircase.
- First floor: 2-3 bedrooms + 2 bathrooms + balcony + family area.
- Staircase usually on side wall to save interior space; aligns across floors.
- Open kitchen + dining + living is the modern Indian open-plan preference.
- Cross-ventilation: windows on two opposite walls per room.
- Internal staircase preferred (saves setbacks).

CONSTRUCTION COST (India 2024, ₹/sqft):
- Basic: ₹850-1,400 | Standard: ₹1,150-1,900 | Premium: ₹1,700-2,800 | Luxury: ₹2,500-4,000
- Breakdown: Foundation 10%, Structure (RCC) 27%, Masonry 8%, Flooring 10%, Electrical 8%, Plumbing 7%, Doors/Windows 10%, Painting 7%, Kitchen/Bath 6%, Other 7%.
- Add 10-15% contingency. Bangalore/Chennai/Mumbai are 20-30% costlier than tier-2 cities.

ALWAYS prioritize: structural safety, local building codes, functional planning, cross-ventilation, and natural light. Vastu is a cultural preference — never compromise safety or code compliance for it.`;

// Helper: check if a room placement roughly satisfies Vastu direction
export function vastuScore(roomType: string, x: number, y: number, width: number, length: number, plotWidth: number, plotLength: number): number {
  const cx = (x + width / 2) / plotWidth; // 0..1
  const cy = (y + length / 2) / plotLength; // 0..1
  const norm = INDIAN_ROOM_NORMS[roomType] || INDIAN_ROOM_NORMS[roomType.replace('-', '')];
  if (!norm?.vastuDirection) return 0.5; // neutral
  const dir = norm.vastuDirection;
  // check quadrant
  if (dir.includes('South-West') && cx > 0.5 && cy > 0.5) return 1;
  if (dir.includes('South-East') && cx > 0.5 && cy < 0.5) return 1;
  if (dir.includes('North-East') && cx < 0.5 && cy < 0.5) return 1;
  if (dir.includes('North-West') && cx < 0.5 && cy > 0.5) return 1;
  if (dir === 'East' && cx > 0.6) return 1;
  if (dir === 'North' && cy < 0.4) return 1;
  if (dir === 'South' && cy > 0.6) return 1;
  if (dir === 'West' && cx < 0.4) return 1;
  // partial credit for adjacent quadrant
  return 0.3;
}
