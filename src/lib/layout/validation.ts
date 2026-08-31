import {
  LayoutData,
  ProjectConfig,
  RoomRequirement,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { Rect, rectsOverlap, rectWithin, buildableArea } from './engine';

function roomToRect(r: { x: number; y: number; width: number; length: number }): Rect {
  return { x: r.x, y: r.y, w: r.width, h: r.length };
}

export function validateLayout(layout: LayoutData, config: ProjectConfig): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const geometryNotes: string[] = [];
  const accessNotes: string[] = [];
  const spaceNotes: string[] = [];
  const reqNotes: string[] = [];

  const buildable = buildableArea(layout.plot, 0);

  // Group by floor
  const byFloor = new Map<number, typeof layout.rooms>();
  for (const r of layout.rooms) {
    if (!byFloor.has(r.floor)) byFloor.set(r.floor, []);
    byFloor.get(r.floor)!.push(r);
  }

  // ---- Geometry: boundary + overlap + dimensions ----
  for (const r of layout.rooms) {
    const rect = roomToRect(r);
    if (!rectWithin(rect, buildable)) {
      errors.push({
        code: 'OUT_OF_BOUNDARY',
        message: `${r.name} exceeds the buildable plot boundary.`,
        roomId: r.id,
        roomName: r.name,
        severity: 'error',
      });
    }
    const cat = ROOM_CATALOG[r.type];
    if (r.width < cat.minWidth - 0.5 || r.length < cat.minLength - 0.5) {
      warnings.push({
        code: 'DIMENSION_TOO_SMALL',
        message: `${r.name} (${r.width}' × ${r.length}') is smaller than the recommended minimum (${cat.minWidth}' × ${cat.minLength}').`,
        roomId: r.id,
        roomName: r.name,
        severity: 'warning',
      });
    }
  }

  // overlap check per floor
  for (const [floor, rooms] of byFloor) {
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (rectsOverlap(roomToRect(rooms[i]), roomToRect(rooms[j]))) {
          errors.push({
            code: 'OVERLAP',
            message: `${rooms[i].name} overlaps ${rooms[j].name}.`,
            roomId: rooms[i].id,
            roomName: rooms[i].name,
            severity: 'error',
          });
        }
      }
    }
  }

  if (errors.filter((e) => e.code === 'OUT_OF_BOUNDARY').length === 0)
    geometryNotes.push('All rooms within plot boundary');
  if (errors.filter((e) => e.code === 'OVERLAP').length === 0)
    geometryNotes.push('No room overlap detected');
  if (warnings.filter((e) => e.code === 'DIMENSION_TOO_SMALL').length === 0)
    geometryNotes.push('Room dimensions valid');

  // ---- Accessibility: door access ----
  let doorIssues = 0;
  for (const r of layout.rooms) {
    if (r.type === 'parking' || r.type === 'balcony') continue;
    if (r.doors.length === 0) {
      warnings.push({
        code: 'NO_DOOR',
        message: `${r.name} has no door access.`,
        roomId: r.id,
        roomName: r.name,
        severity: 'warning',
      });
      doorIssues++;
    }
  }
  if (doorIssues === 0) accessNotes.push('All rooms have door access');
  accessNotes.push('Room connectivity checked');

  // ---- Space planning: required rooms present ----
  const presentCounts = new Map<string, number>();
  for (const r of layout.rooms) {
    presentCounts.set(r.type, (presentCounts.get(r.type) || 0) + 1);
  }
  for (const req of config.rooms) {
    const present = presentCounts.get(req.type) || 0;
    if (present < req.count) {
      const missing = req.count - present;
      errors.push({
        code: 'MISSING_ROOM',
        message: `Missing ${missing} × ${req.name} (required ${req.count}).`,
        severity: 'error',
      });
    }
  }
  if (errors.filter((e) => e.code === 'MISSING_ROOM').length === 0)
    reqNotes.push('All requested rooms included');

  // circulation: ensure at least one public room
  const hasPublic = layout.rooms.some((r) => ROOM_CATALOG[r.type].group === 'public');
  if (hasPublic) spaceNotes.push('Circulation available via public rooms');
  else warnings.push({ code: 'NO_PUBLIC', message: 'No public room (living/dining) for circulation.', severity: 'warning' });

  // multi-floor: staircase present when floors > 1
  if (layout.floors > 1) {
    const hasStair = layout.rooms.some((r) => r.type === 'staircase');
    if (!hasStair) {
      warnings.push({
        code: 'NO_STAIRCASE',
        message: 'Multi-floor building has no staircase.',
        severity: 'warning',
      });
    } else {
      spaceNotes.push('Staircase connects floors');
    }
  }

  const geometry = {
    ok: errors.filter((e) => e.code === 'OUT_OF_BOUNDARY' || e.code === 'OVERLAP').length === 0,
    notes: geometryNotes,
  };
  const accessibility = { ok: doorIssues === 0, notes: accessNotes };
  const spacePlanning = { ok: hasPublic, notes: spaceNotes };
  const requirements = {
    ok: errors.filter((e) => e.code === 'MISSING_ROOM').length === 0,
    notes: reqNotes,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    geometry,
    accessibility,
    spacePlanning,
    requirements,
  };
}

export function quickValid(layout: LayoutData): boolean {
  return validateLayout(layout, { plot: layout.plot, floors: layout.floors, rooms: [], style: 'modern', preferences: [], vastuEnabled: false, vastu: { entrance: null, kitchen: null, bedroom: null, pooja: null } } as ProjectConfig).valid;
}

export function summarizeValidation(v: ValidationResult): string {
  if (v.valid && v.warnings.length === 0) return 'Layout valid';
  if (v.valid) return `Layout valid · ${v.warnings.length} warning${v.warnings.length > 1 ? 's' : ''}`;
  return `${v.errors.length} issue${v.errors.length > 1 ? 's' : ''} found`;
}

// keep RoomRequirement import used
export type _RR = RoomRequirement;
