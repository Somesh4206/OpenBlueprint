'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { LayoutData, ProjectConfig, RoomRect, ValidationResult, DoorMarker, WindowMarker, FurnitureItem, FurnitureType } from '@/lib/types';
import { ROOM_CATALOG } from '@/lib/room-catalog';
import { FURNITURE_MAP } from '@/lib/furniture-catalog';
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

type DragMode = 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' | 'furniture-move' | 'furniture-rotate' | null;

interface DragState {
  roomId?: string;
  furnitureId?: string;
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
    const target = (e.target as Element);
    // furniture hit-test first (furniture renders on top)
    const furnitureId = target.getAttribute('data-furniture-id');
    const furnitureHandle = target.getAttribute('data-furniture-handle');
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
        } else {
          setDrag({ furnitureId, mode: 'furniture-move', startMouse: { x: e.clientX, y: e.clientY }, startFurniture: { ...f } });
        }
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
    }
    // room hit-test
    const roomId = target.getAttribute('data-room-id');
    const handle = target.getAttribute('data-handle') as DragMode;
    if (roomId) {
      const room = layout.rooms.find((r) => r.id === roomId);
      if (room) {
        onSelectRoom(room.id);
        if (handle) {
          setDrag({ roomId, mode: handle, startMouse: { x: e.clientX, y: e.clientY }, startRoom: { ...room } });
        } else if (tool === 'select' || tool === 'room') {
          setDrag({ roomId, mode: 'move', startMouse: { x: e.clientX, y: e.clientY }, startRoom: { ...room } });
        }
        (e.target as Element).setPointerCapture(e.pointerId);
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
      // rotate by 90° on significant horizontal drag
      const f = drag.startFurniture;
      const newRot = ((Math.round((f.rotation + dx) / 90) * 90) % 360 + 360) % 360;
      onUpdateFurniture(drag.furnitureId!, { rotation: newRot });
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
}) {
  const cat = ROOM_CATALOG[room.type];
  const rx = originX + room.x * scale;
  const ry = originY + room.y * scale;
  const rw = room.width * scale;
  const rl = room.length * scale;
  const stroke = hasError ? '#dc2626' : selected ? accentColor : cat.accent;
  const sw = selected ? 2.5 : 1.5;
  const opacity = dimmed ? 0.4 : 1;

  const handleSize = 8;
  const handles = selected ? [
    { id: 'resize-nw', x: rx, y: ry, cursor: 'nwse-resize' },
    { id: 'resize-ne', x: rx + rw, y: ry, cursor: 'nesw-resize' },
    { id: 'resize-sw', x: rx, y: ry + rl, cursor: 'nesw-resize' },
    { id: 'resize-se', x: rx + rw, y: ry + rl, cursor: 'nwse-resize' },
  ] : [];

  return (
    <g style={{ opacity }} className={selected ? '' : 'cursor-pointer'}>
      {/* Room fill */}
      <rect
        data-room-id={room.id}
        x={rx}
        y={ry}
        width={rw}
        height={rl}
        fill={cat.color}
        stroke={stroke}
        strokeWidth={sw}
        onClick={onSelect}
      />
      {hasWarning && !hasError && (
        <rect data-room-id={room.id} x={rx} y={ry} width={rw} height={rl} fill="none" stroke="#d97706" strokeWidth={2} strokeDasharray="4 3" onClick={onSelect} />
      )}
      {hasError && (
        <rect data-room-id={room.id} x={rx} y={ry} width={rw} height={rl} fill="rgba(220,38,38,0.08)" stroke="#dc2626" strokeWidth={2} onClick={onSelect} />
      )}

      {/* Doors */}
      {room.doors.map((d, i) => (
        <DoorGraphic key={i} door={d} rx={rx} ry={ry} rw={rw} rl={rl} scale={scale} accent={accentColor} />
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

      {/* Resize handles */}
      {handles.map((h) => (
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
      ))}
    </g>
  );
}

function DoorGraphic({ door, rx, ry, rw, rl, scale, accent }: { door: DoorMarker; rx: number; ry: number; rw: number; rl: number; scale: number; accent: string }) {
  const dw = door.width * scale;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  let ax1 = 0, ay1 = 0, ax2 = 0, ay2 = 0;
  switch (door.wall) {
    case 'top':
      x1 = rx + rw * door.pos - dw / 2; y1 = ry; x2 = x1 + dw; y2 = ry;
      ax1 = x1; ay1 = ry; ax2 = x1; ay2 = ry + dw;
      break;
    case 'bottom':
      x1 = rx + rw * door.pos - dw / 2; y1 = ry + rl; x2 = x1 + dw; y2 = ry + rl;
      ax1 = x1; ay1 = ry + rl; ax2 = x1; ay2 = ry + rl - dw;
      break;
    case 'left':
      x1 = rx; y1 = ry + rl * door.pos - dw / 2; x2 = rx; y2 = y1 + dw;
      ax1 = rx; ay1 = y1; ax2 = rx + dw; ay2 = y1;
      break;
    case 'right':
      x1 = rx + rw; y1 = ry + rl * door.pos - dw / 2; x2 = rx + rw; y2 = y1 + dw;
      ax1 = rx + rw; ay1 = y1; ax2 = rx + rw - dw; ay2 = y1;
      break;
  }
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={4} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth={1.5} />
      <path d={`M ${ax1} ${ay1} A ${dw} ${dw} 0 0 1 ${ax2} ${ay2}`} fill="none" stroke={accent} strokeWidth={1} opacity={0.6} />
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
    <g style={{ opacity, cursor: 'move' }} transform={`translate(${tx} ${ty}) rotate(${item.rotation} ${bw / 2} ${bl / 2})`}>
      {/* invisible hit area covering the bounding box — receives all pointer events.
          fill with near-invisible opacity so SVG pointer-events:"all" works in all browsers */}
      <rect data-furniture-id={item.id} x={0} y={0} width={bw} height={bl} fill="white" fillOpacity={0.001} pointerEvents="all" />
      {/* the symbol — pointer-events: none so clicks pass through to the hit area */}
      <g transform={`scale(${sx} ${sy})`} pointerEvents="none">
        <svg viewBox="0 0 100 100" width={100} height={100} style={{ overflow: 'visible', pointerEvents: 'none' }}>
          <FurnitureSymbol type={item.type} color={color} className="w-full h-full" />
        </svg>
      </g>
      {/* selection outline + handles */}
      {selected && (
        <>
          <rect x={-2} y={-2} width={bw + 4} height={bl + 4} fill="none" stroke={accentColor} strokeWidth={1.5} strokeDasharray="4 2" pointerEvents="none" />
          {/* rotate handle (top-right) */}
          <g data-furniture-id={item.id} data-furniture-handle="rotate" style={{ cursor: 'grab' }}>
            <circle cx={bw + 12} cy={-12} r={7} fill={accentColor} stroke="white" strokeWidth={1.5} />
            <path d={`M ${bw + 9} -12 A 3 3 0 1 1 ${bw + 15} -12`} fill="none" stroke="white" strokeWidth={1.2} />
          </g>
          {/* delete handle (top-left) */}
          <g data-furniture-id={item.id} data-furniture-handle="delete" style={{ cursor: 'pointer' }}>
            <circle cx={-12} cy={-12} r={7} fill="#dc2626" stroke="white" strokeWidth={1.5} />
            <line x1={-15} y1={-15} x2={-9} y2={-9} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={-9} y1={-15} x2={-15} y2={-9} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        </>
      )}
    </g>
  );
}

