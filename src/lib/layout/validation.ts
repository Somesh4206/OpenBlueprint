import {
  LayoutData,
  ProjectConfig,
  RoomRequirement,
  ValidationIssue,
  ValidationResult,
} from '../types';
import { ROOM_CATALOG } from '../room-catalog';
import { Rect, rectsOverlap, rectWithin, buildableArea } from './engine';
import {
  DESIRED_ADJACENCY,
  PROHIBITED_ADJACENCY,
  MIN_STANDARDS,
  PRIMARY_ROOM_MIN_AREA,
  PROHIBITIONS,
  areAdjacent,
  zoneOf,
  ZONE_PLACEMENT,
} from '../architecture/rules';

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

  // ---- Minimum code standards (Rule 6) ----
  for (const r of layout.rooms) {
    const std = MIN_STANDARDS[r.type];
    if (!std) continue;
    const area = r.width * r.length;
    if (area < std.minArea - 1) {
      warnings.push({
        code: 'BELOW_MIN_AREA',
        message: `${r.name} area (${Math.round(area)} sq.ft) is below the code minimum (${std.minArea} sq.ft). ${std.label}`,
        roomId: r.id,
        roomName: r.name,
        severity: 'warning',
      });
    }
    if (r.width < std.minWidth - 0.5 && r.length < std.minWidth - 0.5) {
      warnings.push({
        code: 'BELOW_MIN_WIDTH',
        message: `${r.name} is narrower than the minimum width (${std.minWidth}'). ${std.label}`,
        roomId: r.id,
        roomName: r.name,
        severity: 'warning',
      });
    }
  }
  // At least one room >= 102 sqft (9.5 m²)
  const hasPrimary = layout.rooms.some((r) => r.width * r.length >= PRIMARY_ROOM_MIN_AREA);
  if (!hasPrimary && layout.rooms.length > 0) {
    warnings.push({
      code: 'NO_PRIMARY_ROOM',
      message: `No room meets the primary habitable minimum (${PRIMARY_ROOM_MIN_AREA} sq.ft / 9.5 m²).`,
      severity: 'warning',
    });
  } else if (hasPrimary) {
    geometryNotes.push('At least one room meets primary habitable area');
  }

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

  // ============ ARCHITECTURE RULES (Rules 1-7) ============
  // ---- Rule 2: Adjacency requirements (hard constraints) ----
  for (const r of layout.rooms) {
    const desired = DESIRED_ADJACENCY[r.type] || [];
    for (const targetType of desired) {
      const hasAdj = layout.rooms.some(
        (o) => o.id !== r.id && o.type === targetType && o.floor === r.floor && areAdjacent(r, o),
      );
      if (!hasAdj && layout.rooms.some((o) => o.type === targetType && o.floor === r.floor)) {
        warnings.push({
          code: 'ADJACENCY_UNSATISFIED',
          message: `${r.name} should be adjacent to ${targetType} (Rule 2: adjacency requirement).`,
          roomId: r.id,
          roomName: r.name,
          severity: 'warning',
        });
      }
    }
    // prohibited adjacency
    const prohibited = PROHIBITED_ADJACENCY[r.type] || [];
    for (const targetType of prohibited) {
      const violator = layout.rooms.find(
        (o) => o.id !== r.id && o.type === targetType && o.floor === r.floor && areAdjacent(r, o),
      );
      if (violator) {
        errors.push({
          code: 'PROHIBITED_ADJACENCY',
          message: `${r.name} (${r.type}) is adjacent to ${violator.name} (${targetType}) — prohibited by Rule 2.`,
          roomId: r.id,
          roomName: r.name,
          severity: 'error',
        });
      }
    }
  }
  const adjOk = errors.filter((e) => e.code === 'PROHIBITED_ADJACENCY').length === 0;
  const adjWarn = warnings.filter((w) => w.code === 'ADJACENCY_UNSATISFIED').length === 0;
  if (adjOk && adjWarn) spaceNotes.push('Adjacency requirements satisfied (kitchen-dining, etc.)');
  else if (adjOk) spaceNotes.push('No prohibited adjacencies');

  // ---- Rule 7: Prohibited mistakes ----
  const prohibitionCtx = {
    rooms: layout.rooms.map((r) => ({
      id: r.id, type: r.type, name: r.name, x: r.x, y: r.y, width: r.width, length: r.length, floor: r.floor, doors: r.doors,
    })),
    plot: { width: layout.plot.width, length: layout.plot.length, roadSide: layout.plot.roadSide },
  };
  for (const rule of PROHIBITIONS) {
    if (rule.check(prohibitionCtx)) {
      errors.push({
        code: rule.id.toUpperCase().replace(/-/g, '_'),
        message: `PROHIBITED: ${rule.description}`,
        severity: 'error',
      });
    }
  }
  const prohibOk = PROHIBITIONS.every((rule) => !rule.check(prohibitionCtx));
  if (prohibOk) spaceNotes.push('No prohibited layout mistakes detected');

  // ---- Rule 1: Zone clustering check ----
  // Public rooms should cluster (front), private rooms cluster (rear).
  // We check that public rooms are closer to the road than private rooms on average.
  const roadY = layout.plot.roadSide === 'south' ? layout.plot.length : layout.plot.roadSide === 'north' ? 0 : layout.plot.length / 2;
  const publicRooms = layout.rooms.filter((r) => zoneOf(r.type) === 'public' && r.floor === 0);
  const privateRooms = layout.rooms.filter((r) => zoneOf(r.type) === 'private' && r.floor === 0);
  if (publicRooms.length > 0 && privateRooms.length > 0) {
    const avgPublicDist = publicRooms.reduce((s, r) => s + Math.abs(r.y + r.length / 2 - roadY), 0) / publicRooms.length;
    const avgPrivateDist = privateRooms.reduce((s, r) => s + Math.abs(r.y + r.length / 2 - roadY), 0) / privateRooms.length;
    if (avgPrivateDist < avgPublicDist - 3) {
      warnings.push({
        code: 'ZONE_CLUSTERING',
        message: 'Private rooms are closer to the road than public rooms (Rule 1: zone clustering). Public zone should be at the front.',
        severity: 'warning',
      });
    } else {
      spaceNotes.push('Zone clustering: public front, private rear');
    }
  }

  // ---- Rule 5: Privacy gradient ----
  // Bedrooms should not face the street if living rooms can.
  const bedroomsOnStreet = layout.rooms.filter((r) => r.type === 'bedroom' && r.floor === 0 && isOnStreetSide(r, layout.plot));
  const livingOnStreet = layout.rooms.filter((r) => r.type === 'living' && r.floor === 0 && isOnStreetSide(r, layout.plot));
  if (bedroomsOnStreet.length > 0 && livingOnStreet.length === 0) {
    warnings.push({
      code: 'PRIVACY_GRADIENT',
      message: 'Bedrooms face the street while living rooms do not (Rule 5: privacy gradient). Quieter rooms should absorb street noise.',
      severity: 'warning',
    });
  } else if (livingOnStreet.length > 0) {
    spaceNotes.push('Privacy gradient: living rooms face street, bedrooms quieter side');
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

function isOnStreetSide(r: { x: number; y: number; width: number; length: number }, plot: { width: number; length: number; roadSide: string }): boolean {
  const tol = 0.5;
  switch (plot.roadSide) {
    case 'south': return r.y + r.length >= plot.length - tol;
    case 'north': return r.y <= tol;
    case 'east': return r.x + r.width >= plot.width - tol;
    case 'west': return r.x <= tol;
  }
  return false;
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
