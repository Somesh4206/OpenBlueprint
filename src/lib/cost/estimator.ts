import {
  CostBreakdown,
  CostEstimate,
  FinishGrade,
  LayoutData,
  MaterialSelection,
} from '../types';

// Base rate per sq.ft in INR (India, 2024 indicative)
const BASE_RATE: Record<FinishGrade, number> = {
  basic: 1500,
  standard: 1800,
  premium: 2300,
  luxury: 3000,
};

// Material multipliers (relative to standard)
const FLOORING_MULT: Record<MaterialSelection['flooring'], number> = {
  ceramic: 1.0,
  vitrified: 1.05,
  marble: 1.15,
  wood: 1.2,
};
const DOOR_MULT: Record<MaterialSelection['doors'], number> = {
  wood: 1.1,
  engineered: 1.0,
  panel: 1.05,
};
const WINDOW_MULT: Record<MaterialSelection['windows'], number> = {
  aluminium: 1.0,
  upvc: 1.08,
  wood: 1.15,
};
const FINISH_MULT: Record<FinishGrade, number> = {
  basic: 0.92,
  standard: 1.0,
  premium: 1.18,
  luxury: 1.35,
};

export function computeBuiltUpArea(layout: LayoutData): number {
  return Math.round(layout.rooms.reduce((s, r) => s + r.width * r.length, 0));
}

export function estimateCost(
  layout: LayoutData,
  finish: FinishGrade,
  materials: MaterialSelection,
): CostEstimate {
  const area = computeBuiltUpArea(layout);
  const base = BASE_RATE[finish];
  const mult =
    FLOORING_MULT[materials.flooring] *
    DOOR_MULT[materials.doors] *
    WINDOW_MULT[materials.windows] *
    FINISH_MULT[finish];
  const ratePerSqft = Math.round(base * mult);
  const total = Math.round(area * ratePerSqft);

  const breakdown: CostBreakdown = {
    foundation: Math.round(total * 0.1),
    structure: Math.round(total * 0.27),
    flooring: Math.round(total * 0.12),
    electrical: Math.round(total * 0.08),
    plumbing: Math.round(total * 0.08),
    doorsWindows: Math.round(total * 0.12),
    painting: Math.round(total * 0.08),
    other: Math.round(total * 0.15),
  };

  return { area, grade: finish, ratePerSqft, total, breakdown, currency: 'INR' };
}

export function formatINR(amount: number): string {
  // Indian numbering: Lakhs / Crores
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Crores`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakhs`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function gradeLabel(g: FinishGrade): string {
  return { basic: 'Basic', standard: 'Standard', premium: 'Premium', luxury: 'Luxury' }[g];
}
