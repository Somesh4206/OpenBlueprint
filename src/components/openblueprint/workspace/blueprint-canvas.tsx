'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { LayoutData, ProjectConfig, RoomRect, ValidationResult, DoorMarker, WindowMarker, FurnitureItem, FurnitureType } from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { FURNITURE_MAP } from '@/lib/furniture-catalog';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Maximize, Ruler } from 'lucide-react';
import { FurnitureSymbol } from './furniture-symbol';

interface Props {
  layout: LayoutData;
  config: ProjectConfig;
  tool: string;
  selectedRoomId: string | null;
  selectedFurnitureId: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectFurniture: (id: string | null) => void;
  onUpdateRoom: (id: string, patch: Partial<RoomRect>) => void;
  onDeleteRoom: (id: string) => void;
  onAddRoom: (type: RoomRect['type']) => void;
  onAddFurniture: (type: FurnitureType, x: number, y: number) => void;
  onUpdateFurniture: (id: string, patch: Partial<FurnitureItem>) => void;
  onDeleteFurniture: (id: string) => void;
  currentFloor: number;
  showAllFloors: boolean;
  showGrid: boolean;
  showDims: boolean;
  showLabels: boolean;
  showFurniture: boolean;
  zoom: number;
  accentColor: string;
  validation: ValidationResult;
}

type DragMode = 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' | 'resize-n' | 'resize-s' | 'resize-w' | 'resize-e' | 'resize-notch' | 'resize-notch2' | 'furniture-move' | 'furniture-rotate' | 'furniture-resize' | 'door-move' | null;

interface DragState {
  roomId?: string;
  furnitureId?: string;
  doorRoomId?: string;
  doorIndex?: number;
  mode: DragMode;
  startMouse: { x: number; y: number };
  startRoom?: RoomRect;
  startFurniture?: FurnitureItem;
}

const SNAP = 0.5; // snap to 0.5 ft

export function BlueprintCanvas({
  layout,
  config,
  tool,
  selectedRoomId,
  selectedFurnitureId,
  onSelectRoom,
  onSelectFurniture,
  onUpdateRoom,
  onDeleteRoom,
  onAddRoom,
  onAddFurniture,
  onUpdateFurniture,
  onDeleteFurniture,
  currentFloor,
  showAllFloors,
  showGrid,
  showDims,
  showLabels,
  showFurniture,
  zoom,
  accentColor,
  validation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [fitDone, setFitDone] = useState(false);

  const { plot } = layout;
  const padding = 30;

  // compute scale to fit
  const baseScale = Math.min(
    (containerSize.w - padding * 2) / plot.width,
    (containerSize.h - padding * 2) / plot.length,
  );
  const scale = baseScale * zoom;

  useEffect(() => {
    function resize() {
      if (containerRef.current) {
        setContainerSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const W = containerSize.w;
  const H = containerSize.h;
  const plotW = plot.width * scale;
  const plotH = plot.length * scale;
  const originX = (W - plotW) / 2 + pan.x;
  const originY = (H - plotH) / 2 + pan.y;

  const toScreen = (x: number, y: number) => ({ x: originX + x * scale, y: originY + y * scale });

  function snap(n: number) {
    return Math.round(n / SNAP) * SNAP;
  }

  // pointer → plot coords
  const toPlot = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left - originX) / scale;
    const py = (e.clientY - rect.top - originY) / scale;
    return { x: px, y: py };
  }, [originX, originY, scale]);

  // mouse handlers
  function onPointerDown(e: React.PointerEvent) {
    if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setPanning(true);
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (drag) return;
    // Walk up the DOM from the click target to find data-* attributes on ancestors.
    // This is needed because clicks on child elements (rect, circle inside <g>) don't
    // have the attributes on the child — they're on the parent <g>.
    let target = e.target as Element;
    let furnitureId: string | null = null;
    let furnitureHandle: string | null = null;
    let doorRoomId: string | null = null;
    let doorIndexAttr: string | null = null;
    let roomId: string | null = null;
    let roomHandle: string | null = null;
    let walkNode: Element | null = target;
    while (walkNode && walkNode !== svgRef.current) {
      if (walkNode.getAttribute) {
        if (!furnitureId) furnitureId = walkNode.getAttribute('data-furniture-id');
        if (!furnitureHandle) furnitureHandle = walkNode.getAttribute('data-furniture-handle');
        if (!doorRoomId) doorRoomId = walkNode.getAttribute('data-door-room-id');
        if (doorIndexAttr === null) doorIndexAttr = walkNode.getAttribute('data-door-index');
        if (!roomId) roomId = walkNode.getAttribute('data-room-id');
        if (!roomHandle) roomHandle = walkNode.getAttribute('data-handle');
      }
      walkNode = walkNode.parentElement;
    }

    // door hit-test (doors on selected rooms are draggable)
    if (doorRoomId && doorIndexAttr !== null) {
      const di = parseInt(doorIndexAttr, 10);
      const room = layout.rooms.find((r) => r.id === doorRoomId);
      if (room && room.doors[di]) {
        setDrag({
          doorRoomId,
          doorIndex: di,
          mode: 'door-move',
          startMouse: { x: e.clientX, y: e.clientY },
          startRoom: { ...room },
        });
        (target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    // furniture hit-test (furniture renders on top)
    if (furnitureId) {
      const f = layout.furniture.find((x) => x.id === furnitureId);
      if (f) {
        // delete handle — immediate delete, no drag
        if (furnitureHandle === 'delete') {
          onDeleteFurniture(f.id);
          return;
        }
        onSelectFurniture(f.id);
        if (furnitureHandle === 'rotate') {
          setDrag({ furnitureId, mode: 'furniture-rotate', startMouse: { x: e.clientX, y: e.clientY }, startFurniture: { ...f } });
        } else if (furnitureHandle === 'resize') {
          setDrag({ furnitureId, mode: 'furniture-resize', startMouse: { x: e.clientX, y: e.clientY }, startFurniture: { ...f } });
        } else {
          setDrag({ furnitureId, mode: 'furniture-move', startMouse: { x: e.clientX, y: e.clientY }, startFurniture: { ...f } });
        }
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    // room hit-test
    if (roomId) {
      const room = layout.rooms.find((r) => r.id === roomId);
      if (room) {
        onSelectRoom(room.id);
        const handle = roomHandle as DragMode;
        if (handle) {
          setDrag({ roomId, mode: handle, startMouse: { x: e.clientX, y: e.clientY }, startRoom: { ...room } });
        } else if (tool === 'select' || tool === 'room') {
          setDrag({ roomId, mode: 'move', startMouse: { x: e.clientX, y: e.clientY }, startRoom: { ...room } });
        }
        (target as Element).setPointerCapture(e.pointerId);
      }
    } else {
      if (tool === 'room') {
        onAddRoom('bedroom');
      } else {
        onSelectRoom(null);
        onSelectFurniture(null);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panning) {
      setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
      return;
    }
    if (!drag) return;
    const dx = (e.clientX - drag.startMouse.x) / scale;
    const dy = (e.clientY - drag.startMouse.y) / scale;

    // door drag — move door position along its wall
    if (drag.mode === 'door-move' && drag.doorRoomId !== undefined && drag.doorIndex !== undefined && drag.startRoom) {
      const room = drag.startRoom;
      const door = room.doors[drag.doorIndex];
      if (!door) return;
      // convert pixel delta to position delta (0..1 along wall)
      let newPos = door.pos;
      if (door.wall === 'top' || door.wall === 'bottom') {
        newPos = door.pos + dx / room.width;
      } else {
        newPos = door.pos + dy / room.length;
      }
      newPos = Math.max(0.05, Math.min(0.95, snap(newPos * 100) / 100));
      const updatedDoors = room.doors.map((d, j) => j === drag.doorIndex ? { ...d, pos: newPos } : d);
      onUpdateRoom(drag.doorRoomId, { doors: updatedDoors });
      return;
    }

    // furniture drag
    if (drag.mode === 'furniture-move' && drag.startFurniture) {
      const f = drag.startFurniture;
      const maxX = plot.width - (f.rotation === 90 || f.rotation === 270 ? f.length : f.width);
      const maxY = plot.length - (f.rotation === 90 || f.rotation === 270 ? f.width : f.length);
      onUpdateFurniture(drag.furnitureId!, {
        x: snap(Math.max(0, Math.min(maxX, f.x + dx))),
        y: snap(Math.max(0, Math.min(maxY, f.y + dy))),
      });
      return;
    }
    if (drag.mode === 'furniture-rotate' && drag.startFurniture) {
      // Rotate: use raw pixel delta for responsiveness — each 40px of drag = 90°
      const f = drag.startFurniture;
      const pixelDx = e.clientX - drag.startMouse.x;
      const steps = Math.round(pixelDx / 40);
      const newRot = ((f.rotation + steps * 90) % 360 + 360) % 360;
      onUpdateFurniture(drag.furnitureId!, { rotation: newRot });
      return;
    }
    if (drag.mode === 'furniture-resize' && drag.startFurniture) {
      // resize: drag bottom-right corner to change width + length
      const f = drag.startFurniture;
      const newW = snap(Math.max(1, f.width + dx));
      const newL = snap(Math.max(1, f.length + dy));
      // clamp so furniture stays within plot
      const maxX = plot.width - f.x;
      const maxY = plot.length - f.y;
      onUpdateFurniture(drag.furnitureId!, {
        width: Math.min(newW, maxX),
        length: Math.min(newL, maxY),
      });
      return;
    }

    // room drag
    const r = drag.startRoom;
    if (!r) return;
    let patch: Partial<RoomRect> = {};
    if (drag.mode === 'move') {
      patch = { x: snap(Math.max(0, Math.min(plot.width - r.width, r.x + dx))), y: snap(Math.max(0, Math.min(plot.length - r.length, r.y + dy))) };
    } else if (drag.mode === 'resize-se') {
      const w = snap(Math.max(4, r.width + dx));
      const l = snap(Math.max(4, r.length + dy));
      patch = { width: Math.min(w, plot.width - r.x), length: Math.min(l, plot.length - r.y) };
    } else if (drag.mode === 'resize-sw') {
      const x2 = r.x + r.width;
      const newX = snap(Math.max(0, Math.min(x2 - 4, r.x + dx)));
      patch = { x: newX, width: snap(x2 - newX) };
    } else if (drag.mode === 'resize-ne') {
      const y2 = r.y + r.length;
      const newY = snap(Math.max(0, Math.min(y2 - 4, r.y + dy)));
      patch = { y: newY, length: snap(y2 - newY) };
    } else if (drag.mode === 'resize-nw') {
      const x2 = r.x + r.width;
      const y2 = r.y + r.length;
      const newX = snap(Math.max(0, Math.min(x2 - 4, r.x + dx)));
      const newY = snap(Math.max(0, Math.min(y2 - 4, r.y + dy)));
      patch = { x: newX, y: newY, width: snap(x2 - newX), length: snap(y2 - newY) };
    } else if (drag.mode === 'resize-n') {
      // Edge: top wall — move top edge up/down
      const y2 = r.y + r.length;
      const newY = snap(Math.max(0, Math.min(y2 - 4, r.y + dy)));
      patch = { y: newY, length: snap(y2 - newY) };
    } else if (drag.mode === 'resize-s') {
      // Edge: bottom wall — move bottom edge up/down
      const l = snap(Math.max(4, r.length + dy));
      patch = { length: Math.min(l, plot.length - r.y) };
    } else if (drag.mode === 'resize-w') {
      // Edge: left wall — move left edge left/right
      const x2 = r.x + r.width;
      const newX = snap(Math.max(0, Math.min(x2 - 4, r.x + dx)));
      patch = { x: newX, width: snap(x2 - newX) };
    } else if (drag.mode === 'resize-e') {
      // Edge: right wall — move right edge left/right
      const w = snap(Math.max(4, r.width + dx));
      patch = { width: Math.min(w, plot.width - r.x) };
    } else if (drag.mode === 'resize-notch') {
      // Dragging the inner vertex of an L-shape or T-shape room
      // This changes both notchW and notchL simultaneously
      const newNotchW = snap(Math.max(2, Math.min(r.width - 4, r.width - dx)));
      const newNotchL = snap(Math.max(2, Math.min(r.length - 4, r.length - dy)));
      patch = { notchW: newNotchW, notchL: newNotchL };
    } else if (drag.mode === 'resize-notch2') {
      // Dragging the LEFT inner vertex of a T-shape (only affects notchW on left side)
      const newNotchW = snap(Math.max(2, Math.min(r.width - 4, r.width - dx)));
      const newNotchL = snap(Math.max(2, Math.min(r.length - 4, r.length - dy)));
      patch = { notchW: newNotchW, notchL: newNotchL };
    }
    onUpdateRoom(drag.roomId!, patch);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (panning) {
      setPanning(false);
      return;
    }
    if (drag) {
      setDrag(null);
    }
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  }

  // HTML5 drag-and-drop from furniture library
  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/x-furniture-type')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }
  function onDrop(e: React.DragEvent) {
    const type = e.dataTransfer.getData('application/x-furniture-type');
    if (!type) return;
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left - originX) / scale;
    const py = (e.clientY - rect.top - originY) / scale;
    const cat = FURNITURE_MAP[type as FurnitureType];
    if (cat) {
      onAddFurniture(type as FurnitureType, snap(px - cat.width / 2), snap(py - cat.length / 2));
    }
  }

  // delete key — deletes selected room OR furniture
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (selectedFurnitureId) {
          onDeleteFurniture(selectedFurnitureId);
        } else if (selectedRoomId) {
          onDeleteRoom(selectedRoomId);
        }
      }
      // 'R' to rotate selected furniture
      if ((e.key === 'r' || e.key === 'R') && selectedFurnitureId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const f = layout.furniture.find((x) => x.id === selectedFurnitureId);
        if (f) {
          onUpdateFurniture(selectedFurnitureId, { rotation: ((f.rotation + 90) % 360 + 360) % 360 });
        }
      }
      // Ctrl+Z = Undo, Ctrl+Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        useApp.getState().undo();
      }
      if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        useApp.getState().redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRoomId, selectedFurnitureId, onDeleteRoom, onDeleteFurniture, onUpdateFurniture, layout.furniture]);

  // error rooms
  const errorRoomIds = new Set(validation.errors.filter((e) => e.roomId).map((e) => e.roomId!));
  const warningRoomIds = new Set(validation.warnings.filter((w) => w.roomId).map((w) => w.roomId!));

  // visible rooms
  const visibleRooms = layout.rooms.filter((r) => showAllFloors || r.floor === currentFloor);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bp-grid overflow-hidden select-none"
      style={{ cursor: tool === 'pan' ? (panning ? 'grabbing' : 'grab') : 'default' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Rulers */}
        <RulerAxis plot={plot} scale={scale} originX={originX} originY={originY} plotW={plotW} plotH={plotH} />

        {/* Road indicator */}
        <RoadIndicator plot={plot} originX={originX} originY={originY} plotW={plotW} plotH={plotH} accent={accentColor} />

        {/* Plot boundary */}
        <rect
          x={originX}
          y={originY}
          width={plotW}
          height={plotH}
          fill="rgba(255,255,255,0.5)"
          stroke="#1e3a5f"
          strokeWidth={2.5}
        />

        {/* Setback area */}
        {config.plot.setbackFront + config.plot.setbackRear + config.plot.setbackSides > 0 && (
          <rect
            x={originX + config.plot.setbackSides * scale}
            y={originY + config.plot.setbackRear * scale}
            width={(plot.width - config.plot.setbackSides * 2) * scale}
            height={(plot.length - config.plot.setbackFront - config.plot.setbackRear) * scale}
            fill="none"
            stroke={accentColor}
            strokeWidth={1}
            strokeDasharray="6 4"
            opacity={0.5}
          />
        )}

        {/* Rooms */}
        {visibleRooms.map((room) => (
          <RoomShape
            key={room.id}
            room={room}
            plot={plot}
            scale={scale}
            originX={originX}
            originY={originY}
            selected={selectedRoomId === room.id}
            onSelect={() => onSelectRoom(room.id)}
            showDims={showDims}
            showLabels={showLabels}
            accentColor={accentColor}
            hasError={errorRoomIds.has(room.id)}
            hasWarning={warningRoomIds.has(room.id)}
            dimmed={showAllFloors && room.floor !== currentFloor}
            allRooms={layout.rooms}
          />
        ))}

        {/* Furniture */}
        {showFurniture && layout.furniture
          .filter((f) => showAllFloors || f.floor === currentFloor)
          .map((f) => (
            <FurnitureShape
              key={f.id}
              item={f}
              scale={scale}
              originX={originX}
              originY={originY}
              selected={selectedFurnitureId === f.id}
              accentColor={accentColor}
              dimmed={showAllFloors && f.floor !== currentFloor}
            />
          ))}

        {/* North arrow */}
        <NorthArrow originX={originX + plotW - 24} originY={originY + 20} accent={accentColor} />

        {/* Scale bar */}
        <g transform={`translate(${originX}, ${originY + plotH + 16})`}>
          <line x1={0} y1={0} x2={10 * scale} y2={0} stroke="#1f2a3a" strokeWidth={1.5} />
          <line x1={0} y1={-4} x2={0} y2={4} stroke="#1f2a3a" strokeWidth={1.5} />
          <line x1={10 * scale} y1={-4} x2={10 * scale} y2={4} stroke="#1f2a3a" strokeWidth={1.5} />
          <text x={5 * scale} y={-7} textAnchor="middle" fontSize={10} fill="#5b6678" className="tech-num">10 {plot.unit}</text>
        </g>

        {/* Dimensions on plot edges */}
        {showDims && (
          <>
            <text x={originX + plotW / 2} y={originY - 8} textAnchor="middle" fontSize={11} fill="#1f2a3a" className="tech-num" fontWeight={600}>
              {plot.width} {plot.unit}
            </text>
            <text
              x={originX - 12}
              y={originY + plotH / 2}
              textAnchor="middle"
              fontSize={11}
              fill="#1f2a3a"
              className="tech-num"
              fontWeight={600}
              transform={`rotate(-90 ${originX - 12} ${originY + plotH / 2})`}
            >
              {plot.length} {plot.unit}
            </text>
          </>
        )}
      </svg>

      {/* Empty state hint */}
      {visibleRooms.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <Ruler className="size-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No rooms on this floor.</p>
            <p className="text-xs">Use the + tool to add a room.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Check if two rooms are adjacent (share a wall segment)
function areRoomsAdjacent(a: { x: number; y: number; width: number; length: number; floor: number }, b: { x: number; y: number; width: number; length: number; floor: number }): boolean {
  if (a.floor !== b.floor) return false;
  const tol = 0.6;
  // vertical wall shared (a.right = b.left or b.right = a.left)
  const vShare = (Math.abs(a.x + a.width - b.x) < tol || Math.abs(b.x + b.width - a.x) < tol) &&
    a.y < b.y + b.length - tol && a.y + a.length > b.y + tol;
  // horizontal wall shared (a.bottom = b.top or b.bottom = a.top)
  const hShare = (Math.abs(a.y + a.length - b.y) < tol || Math.abs(b.y + b.length - a.y) < tol) &&
    a.x < b.x + b.width - tol && a.x + a.width > b.x + tol;
  return vShare || hShare;
}

function RoomShape({
  room,
  plot,
  scale,
  originX,
  originY,
  selected,
  onSelect,
  showDims,
  showLabels,
  accentColor,
  hasError,
  hasWarning,
  dimmed,
  allRooms,
}: {
  room: RoomRect;
  plot: LayoutData['plot'];
  scale: number;
  originX: number;
  originY: number;
  selected: boolean;
  onSelect: () => void;
  showDims: boolean;
  showLabels: boolean;
  accentColor: string;
  hasError: boolean;
  hasWarning: boolean;
  dimmed: boolean;
  allRooms: RoomRect[];
}) {
  const cat = ROOM_CATALOG[room.type];
  const rx = originX + room.x * scale;
  const ry = originY + room.y * scale;
  const rw = room.width * scale;
  const rl = room.length * scale;
  const stroke = hasError ? '#dc2626' : selected ? accentColor : cat.accent;

  // For split rooms: find the partner and determine which edge is shared (no wall)
  const splitPartner = room.splitPartner ? allRooms.find((r) => r.id === room.splitPartner) : null;
  // Also check if any adjacent room is a staircase — skip the wall facing the staircase
  const adjacentStaircase = allRooms.filter((r) => r.id !== room.id && r.floor === room.floor && r.type === 'staircase' && areRoomsAdjacent(room, r));
  // To avoid DOUBLE WALLS (two adjacent rooms each drawing their own wall on the shared edge),
  // only draw a shared wall from ONE side. We use the rule: the room with the SMALLER id draws the wall.
  // The room with the LARGER id skips it. This ensures each shared wall is drawn exactly once.
  const adjacentRooms = allRooms.filter((r) => r.id !== room.id && r.floor === room.floor && areRoomsAdjacent(room, r));
  // Determine shared edge: if partner is to the right, skip right wall; etc.
  let skipTop = false, skipRight = false, skipBottom = false, skipLeft = false;
  if (splitPartner) {
    if (Math.abs(splitPartner.x - (room.x + room.width)) < 0.6) skipRight = true;
    if (Math.abs((splitPartner.x + splitPartner.width) - room.x) < 0.6) skipLeft = true;
    if (Math.abs(splitPartner.y - (room.y + room.length)) < 0.6) skipBottom = true;
    if (Math.abs((splitPartner.y + splitPartner.length) - room.y) < 0.6) skipTop = true;
  }
  // Skip walls facing a staircase (open stairwell)
  for (const sc of adjacentStaircase) {
    if (Math.abs(sc.x - (room.x + room.width)) < 0.6) skipRight = true;
    if (Math.abs((sc.x + sc.width) - room.x) < 0.6) skipLeft = true;
    if (Math.abs(sc.y - (room.y + room.length)) < 0.6) skipBottom = true;
    if (Math.abs((sc.y + sc.length) - room.y) < 0.6) skipTop = true;
  }
  // De-duplicate: for each adjacent room (not staircase, not split partner), only draw the shared
  // wall from the room with the lexicographically smaller id. The other room skips it.
  for (const adj of adjacentRooms) {
    if (adj.type === 'staircase') continue;
    if (adj.id === room.splitPartner) continue;
    // Only skip if this room's id is LARGER than the adjacent room's id (the smaller one draws the wall)
    if (room.id > adj.id) {
      if (Math.abs(adj.x - (room.x + room.width)) < 0.6) skipRight = true;
      if (Math.abs((adj.x + adj.width) - room.x) < 0.6) skipLeft = true;
      if (Math.abs(adj.y - (room.y + room.length)) < 0.6) skipBottom = true;
      if (Math.abs((adj.y + adj.length) - room.y) < 0.6) skipTop = true;
    }
  }
  const sw = selected ? 2 : 1;
  const opacity = dimmed ? 0.4 : 1;

  const handleSize = 8;
  const handles = selected ? [
    // Corner handles
    { id: 'resize-nw', x: rx, y: ry, cursor: 'nwse-resize' },
    { id: 'resize-ne', x: rx + rw, y: ry, cursor: 'nesw-resize' },
    { id: 'resize-sw', x: rx, y: ry + rl, cursor: 'nesw-resize' },
    { id: 'resize-se', x: rx + rw, y: ry + rl, cursor: 'nwse-resize' },
    // Edge midpoint handles — push/pull entire wall
    { id: 'resize-n', x: rx + rw / 2, y: ry, cursor: 'ns-resize' },
    { id: 'resize-s', x: rx + rw / 2, y: ry + rl, cursor: 'ns-resize' },
    { id: 'resize-w', x: rx, y: ry + rl / 2, cursor: 'ew-resize' },
    { id: 'resize-e', x: rx + rw, y: ry + rl / 2, cursor: 'ew-resize' },
  ] : [];

  // For L-shape: add inner vertex handle (the notch corner) that can be dragged
  // For T-shape: add two inner vertex handles (left notch + right notch corners)
  const shapeType = room.shape || 'rect';
  const nW = (room.notchW || room.width * 0.4);
  const nL = (room.notchL || room.length * 0.4);
  if (selected && (shapeType === 'l-shape' || shapeType === 't-shape')) {
    // L-shape inner vertex: at (rx + rw - notchWPx, ry + rl - notchLPx)
    const innerX = rx + rw - nW * scale;
    const innerY = ry + rl - nL * scale;
    handles.push({ id: 'resize-notch', x: innerX, y: innerY, cursor: 'move' });
    if (shapeType === 't-shape') {
      // T-shape has a second inner vertex on the left side
      const innerX2 = rx + nW * scale;
      handles.push({ id: 'resize-notch2', x: innerX2, y: innerY, cursor: 'move' });
    }
  }

  // Compute polygon points for non-rectangular shapes
  const shape = room.shape || 'rect';
  const notchW = room.notchW || room.width * 0.4;
  const notchL = room.notchL || room.length * 0.4;
  const notchWPx = notchW * scale;
  const notchLPx = notchL * scale;

  // L-shape polygon: full rect minus bottom-right notch
  const lShapePoints = `${rx},${ry} ${rx + rw},${ry} ${rx + rw},${ry + rl - notchLPx} ${rx + rw - notchWPx},${ry + rl - notchLPx} ${rx + rw - notchWPx},${ry + rl} ${rx},${ry + rl}`;
  // T-shape polygon: full rect minus bottom-right notch AND bottom-left notch
  const tShapePoints = `${rx},${ry} ${rx + rw},${ry} ${rx + rw},${ry + rl - notchLPx} ${rx + rw - notchWPx},${ry + rl - notchLPx} ${rx + rw - notchWPx},${ry + rl} ${rx + notchWPx},${ry + rl} ${rx + notchWPx},${ry + rl - notchLPx} ${rx},${ry + rl - notchLPx}`;

  const shapePoints = shape === 'l-shape' ? lShapePoints : shape === 't-shape' ? tShapePoints : null;

  return (
    <g style={{ opacity }} className={selected ? '' : 'cursor-pointer'}>
      {/* Room fill — polygon for L/T shapes, rect for regular */}
      {shapePoints ? (
        <polygon
          data-room-id={room.id}
          points={shapePoints}
          fill={cat.color}
          stroke="none"
          onClick={onSelect}
          style={{ pointerEvents: 'all' }}
        />
      ) : (
        <rect
          data-room-id={room.id}
          x={rx}
          y={ry}
          width={rw}
          height={rl}
          fill={cat.color}
          stroke="none"
          onClick={onSelect}
        />
      )}

      {/* Wall segments — for L/T shapes, draw the polygon outline */}
      {shapePoints ? (
        <g pointerEvents="none">
          <polygon points={shapePoints} fill="none" stroke={stroke} strokeWidth={sw} />
        </g>
      ) : (
        <g pointerEvents="none">
          {!skipTop && <line x1={rx} y1={ry} x2={rx + rw} y2={ry} stroke={stroke} strokeWidth={sw} />}
          {!skipBottom && <line x1={rx} y1={ry + rl} x2={rx + rw} y2={ry + rl} stroke={stroke} strokeWidth={sw} />}
          {!skipLeft && <line x1={rx} y1={ry} x2={rx} y2={ry + rl} stroke={stroke} strokeWidth={sw} />}
          {!skipRight && <line x1={rx + rw} y1={ry} x2={rx + rw} y2={ry + rl} stroke={stroke} strokeWidth={sw} />}
        </g>
      )}
      {hasWarning && !hasError && (
        <rect data-room-id={room.id} x={rx} y={ry} width={rw} height={rl} fill="none" stroke="#d97706" strokeWidth={2} strokeDasharray="4 3" onClick={onSelect} />
      )}
      {hasError && (
        <rect data-room-id={room.id} x={rx} y={ry} width={rw} height={rl} fill="rgba(220,38,38,0.08)" stroke="#dc2626" strokeWidth={2} onClick={onSelect} />
      )}

      {/* Doors */}
      {room.doors.map((d, i) => (
        <DoorGraphic key={i} door={d} roomId={room.id} doorIndex={i} rx={rx} ry={ry} rw={rw} rl={rl} scale={scale} accent={accentColor} selected={selected} />
      ))}
      {/* Windows */}
      {room.windows.map((w, i) => (
        <WindowGraphic key={i} window={w} rx={rx} ry={ry} rw={rw} rl={rl} scale={scale} />
      ))}

      {/* Labels */}
      {showLabels && rw > 50 && rl > 32 && (
        <>
          <text x={rx + rw / 2} y={ry + rl / 2 - 2} textAnchor="middle" fontSize={Math.max(9, Math.min(13, rw / 10))} fontWeight={600} fill="#1f2a3a" pointerEvents="none">
            {room.name}
          </text>
          {showDims && rl > 44 && (
            <text x={rx + rw / 2} y={ry + rl / 2 + 13} textAnchor="middle" fontSize={Math.max(8, Math.min(10, rw / 12))} fill="#5b6678" className="tech-num" pointerEvents="none">
              {fmt(room.width)} × {fmt(room.length)}
            </text>
          )}
        </>
      )}

      {/* Resize handles — corner handles are squares, edge handles are circles */}
      {handles.map((h) => {
        const isCorner = h.id.includes('nw') || h.id.includes('ne') || h.id.includes('sw') || h.id.includes('se');
        // Notch handles (inner vertices) — larger, distinct color, with crosshair
        if (h.id === 'resize-notch' || h.id === 'resize-notch2') {
          return (
            <g key={h.id} data-room-id={room.id} data-handle={h.id} style={{ cursor: 'move' }}>
              <circle
                cx={h.x}
                cy={h.y}
                r={handleSize / 2 + 3}
                fill="#2b6fe0"
                stroke="white"
                strokeWidth={2}
                className="resize-handle"
                style={{ pointerEvents: 'all' }}
              />
              {/* Crosshair indicator */}
              <line x1={h.x - 5} y1={h.y} x2={h.x + 5} y2={h.y} stroke="white" strokeWidth={1} pointerEvents="none" />
              <line x1={h.x} y1={h.y - 5} x2={h.x} y2={h.y + 5} stroke="white" strokeWidth={1} pointerEvents="none" />
            </g>
          );
        }
        return isCorner ? (
          <rect
            key={h.id}
            data-room-id={room.id}
            data-handle={h.id}
            x={h.x - handleSize / 2}
            y={h.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill={accentColor}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: h.cursor }}
            className="resize-handle"
          />
        ) : (
          <circle
            key={h.id}
            data-room-id={room.id}
            data-handle={h.id}
            cx={h.x}
            cy={h.y}
            r={handleSize / 2 + 1}
            fill={accentColor}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: h.cursor }}
            className="resize-handle"
          />
        );
      })}

      {/* Live dimension display when selected — shows W×L and area */}
      {selected && (
        <g pointerEvents="none">
          {/* Width dimension on top */}
          <line x1={rx} y1={ry - 16} x2={rx + rw} y2={ry - 16} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <line x1={rx} y1={ry - 19} x2={rx} y2={ry - 13} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <line x1={rx + rw} y1={ry - 19} x2={rx + rw} y2={ry - 13} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <rect x={rx + rw / 2 - 20} y={ry - 24} width={40} height={14} fill="white" stroke={accentColor} strokeWidth={0.5} rx={2} />
          <text x={rx + rw / 2} y={ry - 14} textAnchor="middle" fontSize={9} fill={accentColor} fontWeight={600} className="tech-num">
            {fmt(room.width)}'
          </text>
          {/* Length dimension on left */}
          <line x1={rx - 16} y1={ry} x2={rx - 16} y2={ry + rl} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <line x1={rx - 19} y1={ry} x2={rx - 13} y2={ry} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <line x1={rx - 19} y1={ry + rl} x2={rx - 13} y2={ry + rl} stroke={accentColor} strokeWidth={0.8} opacity={0.6} />
          <rect x={rx - 28} y={ry + rl / 2 - 7} width={24} height={14} fill="white" stroke={accentColor} strokeWidth={0.5} rx={2} />
          <text x={rx - 16} y={ry + rl / 2 + 3} textAnchor="middle" fontSize={9} fill={accentColor} fontWeight={600} className="tech-num" transform={`rotate(-90 ${rx - 16} ${ry + rl / 2 + 3})`}>
            {fmt(room.length)}'
          </text>
          {/* Area label */}
          <text x={rx + rw / 2} y={ry + rl / 2 + 26} textAnchor="middle" fontSize={8} fill={accentColor} fontWeight={500} className="tech-num" opacity={0.8}>
            {Math.round(room.width * room.length)} sq.ft
          </text>
        </g>
      )}
    </g>
  );
}

function DoorGraphic({ door, roomId, doorIndex, rx, ry, rw, rl, scale, accent, selected }: { door: DoorMarker; roomId: string; doorIndex: number; rx: number; ry: number; rw: number; rl: number; scale: number; accent: string; selected: boolean }) {
  const dw = door.width * scale;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  // hinge point + arc endpoint depend on swing direction
  let hx = 0, hy = 0, ax = 0, ay = 0;
  let sweepFlag = 0; // 0 = ccw, 1 = cw
  let largeArc = 0;

  switch (door.wall) {
    case 'top':
      x1 = rx + rw * door.pos - dw / 2; y1 = ry; x2 = x1 + dw; y2 = ry;
      // hinge on left or right of door opening based on swing
      if (door.swing === 'in-right' || door.swing === 'out-right') {
        hx = x2; hy = ry; ax = x2; ay = ry + dw; sweepFlag = 0; // hinge right, swings in
      } else {
        hx = x1; hy = ry; ax = x1; ay = ry + dw; sweepFlag = 1; // hinge left, swings in
      }
      if (door.swing === 'out-right' || door.swing === 'out-left') { ay = ry - dw; }
      break;
    case 'bottom':
      x1 = rx + rw * door.pos - dw / 2; y1 = ry + rl; x2 = x1 + dw; y2 = ry + rl;
      if (door.swing === 'in-right' || door.swing === 'out-right') {
        hx = x2; hy = ry + rl; ax = x2; ay = ry + rl - dw; sweepFlag = 1;
      } else {
        hx = x1; hy = ry + rl; ax = x1; ay = ry + rl - dw; sweepFlag = 0;
      }
      if (door.swing === 'out-right' || door.swing === 'out-left') { ay = ry + rl + dw; }
      break;
    case 'left':
      x1 = rx; y1 = ry + rl * door.pos - dw / 2; x2 = rx; y2 = y1 + dw;
      if (door.swing === 'in-right' || door.swing === 'out-right') {
        hx = rx; hy = y2; ax = rx + dw; ay = y2; sweepFlag = 1;
      } else {
        hx = rx; hy = y1; ax = rx + dw; ay = y1; sweepFlag = 0;
      }
      if (door.swing === 'out-right' || door.swing === 'out-left') { ax = rx - dw; }
      break;
    case 'right':
      x1 = rx + rw; y1 = ry + rl * door.pos - dw / 2; x2 = rx + rw; y2 = y1 + dw;
      if (door.swing === 'in-right' || door.swing === 'out-right') {
        hx = rx + rw; hy = y2; ax = rx + rw - dw; ay = y2; sweepFlag = 0;
      } else {
        hx = rx + rw; hy = y1; ax = rx + rw - dw; ay = y1; sweepFlag = 1;
      }
      if (door.swing === 'out-right' || door.swing === 'out-left') { ax = rx + rw + dw; }
      break;
  }
  return (
    <g>
      {/* door gap (white erase) */}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={4} pointerEvents="none" />
      {/* door panel line */}
      <line x1={hx} y1={hy} x2={ax} y2={ay} stroke={accent} strokeWidth={1.8} pointerEvents="none" />
      {/* swing arc */}
      <path d={`M ${x1 === x2 ? ax : (hx === x1 ? x2 : x1)} ${y1 === y2 ? ay : (hy === y1 ? y2 : y1)} A ${dw} ${dw} 0 ${largeArc} ${sweepFlag} ${ax} ${ay}`} fill="none" stroke={accent} strokeWidth={0.8} opacity={0.5} pointerEvents="none" />
      {/* draggable hit area — only visible when room is selected */}
      {selected && (
        <rect
          data-door-room-id={roomId}
          data-door-index={doorIndex}
          x={Math.min(x1, x2) - 4}
          y={Math.min(y1, y2) - 4}
          width={Math.abs(x2 - x1) + 8}
          height={Math.abs(y2 - y1) + 8}
          fill={accent}
          fillOpacity={0.15}
          stroke={accent}
          strokeWidth={1}
          strokeDasharray="2 2"
          style={{ cursor: 'ew-resize' }}
        />
      )}
    </g>
  );
}

function WindowGraphic({ window: w, rx, ry, rw, rl, scale }: { window: WindowMarker; rx: number; ry: number; rw: number; rl: number; scale: number }) {
  const ww = w.width * scale;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  switch (w.wall) {
    case 'top': x1 = rx + rw * w.pos - ww / 2; y1 = ry; x2 = x1 + ww; y2 = ry; break;
    case 'bottom': x1 = rx + rw * w.pos - ww / 2; y1 = ry + rl; x2 = x1 + ww; y2 = ry + rl; break;
    case 'left': x1 = rx; y1 = ry + rl * w.pos - ww / 2; x2 = rx; y2 = y1 + ww; break;
    case 'right': x1 = rx + rw; y1 = ry + rl * w.pos - ww / 2; x2 = rx + rw; y2 = y1 + ww; break;
  }
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e3a5f" strokeWidth={4} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ec5ff" strokeWidth={1.5} strokeDasharray="3 2" />
    </g>
  );
}

function RoadIndicator({ plot, originX, originY, plotW, plotH, accent }: { plot: LayoutData['plot']; originX: number; originY: number; plotW: number; plotH: number; accent: string }) {
  const w = 5;
  switch (plot.roadSide) {
    case 'south':
      return <g><rect x={originX} y={originY + plotH} width={plotW} height={w} fill={accent} opacity={0.3} /><text x={originX + plotW / 2} y={originY + plotH + 14} textAnchor="middle" fontSize={8} fill={accent} fontWeight={600}>ROAD</text></g>;
    case 'north':
      return <g><rect x={originX} y={originY - w} width={plotW} height={w} fill={accent} opacity={0.3} /><text x={originX + plotW / 2} y={originY - 8} textAnchor="middle" fontSize={8} fill={accent} fontWeight={600}>ROAD</text></g>;
    case 'east':
      return <g><rect x={originX + plotW} y={originY} width={w} height={plotH} fill={accent} opacity={0.3} /><text x={originX + plotW + 12} y={originY + plotH / 2} textAnchor="middle" fontSize={8} fill={accent} fontWeight={600} transform={`rotate(90 ${originX + plotW + 12} ${originY + plotH / 2})`}>ROAD</text></g>;
    case 'west':
      return <g><rect x={originX - w} y={originY} width={w} height={plotH} fill={accent} opacity={0.3} /><text x={originX - 12} y={originY + plotH / 2} textAnchor="middle" fontSize={8} fill={accent} fontWeight={600} transform={`rotate(-90 ${originX - 12} ${originY + plotH / 2})`}>ROAD</text></g>;
  }
}

function NorthArrow({ originX, originY, accent }: { originX: number; originY: number; accent: string }) {
  return (
    <g transform={`translate(${originX}, ${originY})`} pointerEvents="none">
      <circle cx={0} cy={0} r={14} fill="white" stroke="#1f2a3a" strokeWidth={1} />
      <path d="M 0 -10 L -4 6 L 0 3 L 4 6 Z" fill={accent} stroke={accent} />
      <text x={0} y={-16} textAnchor="middle" fontSize={9} fontWeight={700} fill="#1f2a3a">N</text>
    </g>
  );
}

function RulerAxis({ plot, scale, originX, originY, plotW, plotH }: { plot: LayoutData['plot']; scale: number; originX: number; originY: number; plotW: number; plotH: number }) {
  const ticksTop: React.ReactElement[] = [];
  for (let i = 0; i <= plot.width; i += Math.max(1, Math.round(plot.width / 10))) {
    const x = originX + i * scale;
    ticksTop.push(
      <g key={`t${i}`}>
        <line x1={x} y1={originY - 6} x2={x} y2={originY - 2} stroke="#9aa3b0" strokeWidth={0.8} />
        <text x={x} y={originY - 9} textAnchor="middle" fontSize={7} fill="#9aa3b0" className="tech-num">{i}</text>
      </g>,
    );
  }
  const ticksLeft: React.ReactElement[] = [];
  for (let i = 0; i <= plot.length; i += Math.max(1, Math.round(plot.length / 10))) {
    const y = originY + i * scale;
    ticksLeft.push(
      <g key={`l${i}`}>
        <line x1={originX - 6} y1={y} x2={originX - 2} y2={y} stroke="#9aa3b0" strokeWidth={0.8} />
        <text x={originX - 9} y={y + 2} textAnchor="end" fontSize={7} fill="#9aa3b0" className="tech-num">{i}</text>
      </g>,
    );
  }
  return <g pointerEvents="none">{ticksTop}{ticksLeft}</g>;
}

function fmt(n: number): string {
  const ft = Math.floor(n);
  const inch = Math.round((n - ft) * 12);
  if (inch === 0) return `${ft}'`;
  return `${ft}'${inch}"`;
}

// ---- Furniture shape (renders the SVG symbol + selection handles) ----
function FurnitureShape({
  item,
  scale,
  originX,
  originY,
  selected,
  accentColor,
  dimmed,
}: {
  item: FurnitureItem;
  scale: number;
  originX: number;
  originY: number;
  selected: boolean;
  accentColor: string;
  dimmed: boolean;
}) {
  const cat = FURNITURE_MAP[item.type];
  const color = item.color || cat?.color || '#999';
  // bounding box after rotation
  const rotated = item.rotation === 90 || item.rotation === 270;
  const bw = (rotated ? item.length : item.width) * scale;
  const bl = (rotated ? item.width : item.length) * scale;
  // center in screen coords
  const cx = originX + (item.x + item.width / 2) * scale;
  const cy = originY + (item.y + item.length / 2) * scale;
  const tx = cx - bw / 2;
  const ty = cy - bl / 2;

  const opacity = dimmed ? 0.4 : 1;
  // scale factor from the 100×100 symbol viewBox to the furniture's pixel size
  const sx = (item.width * scale) / 100;
  const sy = (item.length * scale) / 100;

  return (
    <g style={{ opacity, cursor: 'move', pointerEvents: 'all' } as React.CSSProperties} transform={`translate(${tx} ${ty}) rotate(${item.rotation} ${bw / 2} ${bl / 2})`}>
      {/* invisible hit area covering the bounding box — receives all pointer events.
          Use fillOpacity 0.02 (above browser threshold for pointer events) */}
      <rect
        data-furniture-id={item.id}
        x={0}
        y={0}
        width={bw}
        height={bl}
        fill="white"
        fillOpacity={0.02}
        style={{ pointerEvents: 'all' }}
      />
      {/* the symbol — pointer-events: none so clicks pass through to the hit area */}
      <g transform={`scale(${sx} ${sy})`} style={{ pointerEvents: 'none' }}>
        <svg viewBox="0 0 100 100" width={100} height={100} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <FurnitureSymbol type={item.type} color={color} className="w-full h-full" />
        </svg>
      </g>
      {/* selection outline + handles */}
      {selected && (
        <>
          <rect x={-2} y={-2} width={bw + 4} height={bl + 4} fill="none" stroke={accentColor} strokeWidth={1.5} strokeDasharray="4 2" style={{ pointerEvents: 'none' }} />
          {/* resize handle (bottom-right corner) — drag to resize */}
          <g data-furniture-id={item.id} data-furniture-handle="resize" style={{ cursor: 'nwse-resize', pointerEvents: 'all' } as React.CSSProperties}>
            <rect x={bw - 6} y={bl - 6} width={12} height={12} fill={accentColor} stroke="white" strokeWidth={1.5} rx={2} />
            <line x1={bw - 2} y1={bl - 2} x2={bw + 2} y2={bl + 2} stroke="white" strokeWidth={1} />
          </g>
          {/* rotate handle (top-right) */}
          <g data-furniture-id={item.id} data-furniture-handle="rotate" style={{ cursor: 'grab', pointerEvents: 'all' } as React.CSSProperties}>
            <circle cx={bw + 14} cy={-14} r={8} fill={accentColor} stroke="white" strokeWidth={1.5} />
            <path d={`M ${bw + 10} -14 A 4 4 0 1 1 ${bw + 18} -14`} fill="none" stroke="white" strokeWidth={1.2} />
          </g>
          {/* delete handle (top-left) */}
          <g data-furniture-id={item.id} data-furniture-handle="delete" style={{ cursor: 'pointer', pointerEvents: 'all' } as React.CSSProperties}>
            <circle cx={-14} cy={-14} r={8} fill="#dc2626" stroke="white" strokeWidth={1.5} />
            <line x1={-17} y1={-17} x2={-11} y2={-11} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={-11} y1={-17} x2={-17} y2={-11} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        </>
      )}
    </g>
  );
}

