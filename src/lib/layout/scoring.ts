import { LayoutData, LayoutScore, ProjectConfig } from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { buildableArea } from './engine';

export function scoreLayout(layout: LayoutData, config: ProjectConfig): LayoutScore {
  const buildable = buildableArea(layout.plot, 0);
  const totalBuildable = buildable.w * buildable.h * layout.floors;
  const builtUp = layout.rooms.reduce((s, r) => s + r.width * r.length, 0);

  // Space utilization — how much of buildable is used (target 70-90%)
  const utilization = totalBuildable > 0 ? builtUp / totalBuildable : 0;
  const spaceUtilization = clampScore(utilization > 0.9 ? 100 : utilization * 110);

  // Requirement match
  const reqCounts = new Map<string, number>();
  for (const r of config.rooms) reqCounts.set(r.type, (reqCounts.get(r.type) || 0) + r.count);
  const presentCounts = new Map<string, number>();
  for (const r of layout.rooms) presentCounts.set(r.type, (presentCounts.get(r.type) || 0) + 1);
  let reqMatch = 0;
  let reqTotal = 0;
  for (const [type, needed] of reqCounts) {
    reqTotal += needed;
    reqMatch += Math.min(needed, presentCounts.get(type) || 0);
  }
  const requirementMatch = reqTotal > 0 ? Math.round((reqMatch / reqTotal) * 100) : 100;

  // Dimension validity
  let dimValid = 0;
  let dimTotal = 0;
  for (const r of layout.rooms) {
    const cat = ROOM_CATALOG[r.type];
    dimTotal++;
    if (r.width >= cat.minWidth - 0.5 && r.length >= cat.minLength - 0.5) dimValid++;
  }
  const dimensionValidity = dimTotal > 0 ? Math.round((dimValid / dimTotal) * 100) : 100;

  // Circulation — fraction of rooms with doors
  const doorRooms = layout.rooms.filter((r) => r.doors.length > 0).length;
  const circulation = layout.rooms.length > 0 ? Math.round((doorRooms / layout.rooms.length) * 100) : 0;

  // Ventilation — fraction of rooms with windows on outer walls
  const ventRooms = layout.rooms.filter((r) => r.windows.length > 0).length;
  const ventilation = layout.rooms.length > 0
    ? Math.round((ventRooms / Math.max(1, layout.rooms.filter((r) => r.type !== 'parking').length)) * 100)
    : 0;

  // Simplicity — fewer, more rectangular rooms score higher
  const roomCount = layout.rooms.length;
  const simplicity = clampScore(100 - Math.max(0, roomCount - 8) * 6);

  const total = Math.round(
    spaceUtilization * 0.2 +
      circulation * 0.15 +
      Math.min(100, ventilation) * 0.15 +
      requirementMatch * 0.25 +
      dimensionValidity * 0.15 +
      simplicity * 0.1,
  );

  return {
    total: clampScore(total),
    spaceUtilization: Math.round(spaceUtilization),
    circulation,
    ventilation: clampScore(ventilation),
    requirementMatch,
    dimensionValidity,
    simplicity,
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreBreakdownBars(score: LayoutScore) {
  return [
    { label: 'Space Utilization', value: score.spaceUtilization, color: '#2b4a7a' },
    { label: 'Circulation', value: score.circulation, color: '#2d6b78' },
    { label: 'Ventilation', value: score.ventilation, color: '#2a8f5a' },
    { label: 'Requirement Match', value: score.requirementMatch, color: '#4a6b2a' },
    { label: 'Dimension Validity', value: score.dimensionValidity, color: '#7a6a2a' },
  ];
}
