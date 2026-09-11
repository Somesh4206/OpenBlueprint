'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sun,
  Building2,
  FileText,
  Users,
  Crown,
  Zap,
  Shield,
  Calculator,
  CheckCircle2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanTier = 'starter' | 'pro' | 'studio';

interface ProFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tier: PlanTier;
  enabled: boolean;
  component?: React.ComponentType;
}

// ============ Sunlight & Shadow Analysis ============
export function SunlightAnalysis({ layout, accentColor }: { layout: { plot: { width: number; length: number }; rooms: { x: number; y: number; width: number; length: number; type: string; windows: { wall: string }[] }[] }; accentColor: string }) {
  const [hour, setHour] = useState(12); // 6am-6pm
  const sunAngle = ((hour - 6) / 12) * Math.PI; // 0 to PI
  const sunX = Math.cos(sunAngle);
  const sunY = -Math.sin(sunAngle) * 0.7; // vertical component

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sun className="size-4 text-amber-500" />
        <span className="text-sm font-semibold">Sunlight & Shadow Analysis</span>
        <Badge variant="secondary" className="text-[9px]">PRO</Badge>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Time of Day: {hour}:00</Label>
        <input type="range" min={6} max={18} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full" />
      </div>
      <div className="relative bg-gradient-to-b from-sky-100 to-sky-50 rounded-lg p-2 border border-border" style={{ aspectRatio: '4/3' }}>
        <svg viewBox={`0 0 ${layout.plot.width} ${layout.plot.length}`} className="w-full h-full">
          {/* Sun position indicator */}
          <circle cx={layout.plot.width / 2 + sunX * layout.plot.width * 0.3} cy={layout.plot.length / 2 + sunY * layout.plot.length * 0.3} r={2} fill="#fbbf24" />
          {/* Room shadows */}
          {layout.rooms.map((room, i) => {
            const hasWindow = room.windows.length > 0;
            const shadowOffsetX = -sunX * 2;
            const shadowOffsetY = -sunY * 2;
            return (
              <g key={i}>
                <rect
                  x={room.x + shadowOffsetX}
                  y={room.y + shadowOffsetY}
                  width={room.width}
                  height={room.length}
                  fill="rgba(0,0,0,0.15)"
                  className="transition-all duration-300"
                />
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.length}
                  fill={hasWindow ? `rgba(251, 191, 36, ${0.1 + (1 - Math.abs(sunX)) * 0.2})` : 'rgba(200,200,200,0.3)'}
                  stroke={accentColor}
                  strokeWidth={0.3}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-muted-foreground">
        <p>Yellow rooms = direct sunlight reaching through windows</p>
        <p>Gray shadows = areas blocked from sun at {hour}:00</p>
      </div>
    </div>
  );
}

// ============ Vastu Compliance Report ============
export function VastuReport({ config }: { config: { rooms: { type: string; name: string; x: number; y: number; width: number; length: number }[]; plot: { width: number; length: number; roadSide: string } } }) {
  const vastuRules = [
    { room: 'bedroom', direction: 'SW', label: 'Master Bedroom (SW)', desc: 'Stability & prosperity' },
    { room: 'kitchen', direction: 'SE', label: 'Kitchen (SE)', desc: 'Agni corner — fire element' },
    { room: 'pooja', direction: 'NE', label: 'Pooja Room (NE)', desc: 'Ishan — sacred corner' },
    { room: 'living', direction: 'N/NE', label: 'Living Room (N/NE)', desc: 'Positive energy entry' },
    { room: 'bathroom', direction: 'NW/W', label: 'Bathroom (NW/W)', desc: 'Avoid NE & SW' },
    { room: 'staircase', direction: 'S/W/SW', label: 'Staircase (S/W)', desc: 'Clockwise ascent' },
  ];

  const getQuadrant = (room: { x: number; y: number; width: number; length: number }) => {
    const cx = (room.x + room.width / 2) / config.plot.width;
    const cy = (room.y + room.length / 2) / config.plot.length;
    if (cx < 0.5 && cy < 0.5) return 'NE';
    if (cx >= 0.5 && cy < 0.5) return 'SE';
    if (cx < 0.5 && cy >= 0.5) return 'NW';
    return 'SW';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="size-4 text-primary" />
        <span className="text-sm font-semibold">Vastu Compliance Report</span>
        <Badge variant="secondary" className="text-[9px]">PRO</Badge>
      </div>
      <div className="space-y-1.5">
        {vastuRules.map((rule) => {
          const room = config.rooms.find((r) => r.type === rule.room);
          if (!room) return null;
          const quadrant = getQuadrant(room);
          const compliant = rule.direction.includes(quadrant);
          return (
            <div key={rule.room} className={cn('flex items-center gap-2 p-2 rounded-md', compliant ? 'bg-emerald-50' : 'bg-amber-50')}>
              {compliant ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="size-4 text-amber-600 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{rule.label}</p>
                <p className="text-[10px] text-muted-foreground">{rule.desc}</p>
              </div>
              <Badge variant={compliant ? 'default' : 'secondary'} className="text-[9px]">
                {quadrant} {compliant ? '✓' : '✗'}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ============ BOQ (Bill of Quantities) ============
export function BOQPanel({ layout, finish }: { layout: { rooms: { width: number; length: number; type: string }[]; plot: { width: number; length: number } }; finish: string }) {
  const builtUp = layout.rooms.reduce((s, r) => s + r.width * r.length, 0);
  const wallLength = layout.rooms.reduce((s, r) => s + 2 * (r.width + r.length), 0);
  const wallArea = wallLength * 10; // ~10ft wall height

  const items = [
    { name: 'Cement (bags)', qty: Math.round(builtUp * 0.4), unit: 'bags', rate: 400, icon: '🪣' },
    { name: 'Steel (TMT bars)', qty: Math.round(builtUp * 0.004 * 1000) / 10, unit: 'kg', rate: 75, icon: '🔩' },
    { name: 'Bricks', qty: Math.round(wallArea * 8), unit: 'nos', rate: 8, icon: '🧱' },
    { name: 'Sand', qty: Math.round(builtUp * 0.06 * 10) / 10, unit: 'cu.m', rate: 1800, icon: '🏖️' },
    { name: 'Aggregate', qty: Math.round(builtUp * 0.08 * 10) / 10, unit: 'cu.m', rate: 1500, icon: '⛏️' },
    { name: 'Flooring tiles', qty: Math.round(builtUp), unit: 'sq.ft', rate: finish === 'luxury' ? 120 : finish === 'premium' ? 80 : 45, icon: '▦' },
    { name: 'Paint', qty: Math.round(wallArea * 0.15), unit: 'litres', rate: 350, icon: '🎨' },
    { name: 'Electrical (wiring+points)', qty: Math.round(builtUp / 50), unit: 'points', rate: 1200, icon: '⚡' },
    { name: 'Plumbing (pipes+fittings)', qty: Math.round(builtUp / 100), unit: 'sets', rate: 8000, icon: '🚿' },
    { name: 'Doors', qty: layout.rooms.length, unit: 'nos', rate: finish === 'luxury' ? 18000 : 10000, icon: '🚪' },
    { name: 'Windows', qty: Math.round(builtUp / 80), unit: 'nos', rate: finish === 'luxury' ? 15000 : 8000, icon: '🪟' },
  ];

  const total = items.reduce((s, i) => s + i.qty * i.rate, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="size-4 text-primary" />
        <span className="text-sm font-semibold">Bill of Quantities (BOQ)</span>
        <Badge variant="secondary" className="text-[9px]">STUDIO</Badge>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto scroll-thin">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/40">
            <div className="flex items-center gap-2">
              <span className="text-base">{item.icon}</span>
              <div>
                <p className="text-xs font-medium">{item.name}</p>
                <p className="text-[9px] text-muted-foreground tech-num">{item.qty} {item.unit} × ₹{item.rate}</p>
              </div>
            </div>
            <span className="text-xs font-semibold tech-num">₹{(item.qty * item.rate).toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Total Material Cost</span>
          <span className="text-lg font-bold tech-num text-primary">₹{(total / 100000).toFixed(2)} Lakhs</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Excludes labor, permits, and contingency. Preliminary estimate only.</p>
      </div>
    </div>
  );
}

// ============ Custom Branding ============
export function BrandingPanel({ onApply }: { onApply: (branding: { firmName: string; logo: string; color: string }) => void }) {
  const [firmName, setFirmName] = useState('');
  const [color, setColor] = useState('#2b4a7a');
  const [logo, setLogo] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="size-4 text-amber-500" />
        <span className="text-sm font-semibold">Custom Branding</span>
        <Badge variant="secondary" className="text-[9px]">STUDIO</Badge>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Firm Name</Label>
        <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Sharma Architects" className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Logo URL (optional)</Label>
        <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Brand Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-8 rounded cursor-pointer" />
          <span className="text-xs tech-num">{color}</span>
        </div>
      </div>
      <Button size="sm" className="w-full gap-1.5" onClick={() => onApply({ firmName, logo, color })}>
        <CheckCircle2 className="size-3.5" /> Apply Branding to Exports
      </Button>
    </div>
  );
}

// ============ Structural Analysis ============
export function StructuralAnalysis({ layout }: { layout: { rooms: { x: number; y: number; width: number; length: number; type: string }[]; plot: { width: number; length: number } } }) {
  // Identify load-bearing walls (outer perimeter + major internal walls)
  const outerWalls = [
    { label: 'Front Wall', length: layout.plot.width, loadBearing: true },
    { label: 'Rear Wall', length: layout.plot.width, loadBearing: true },
    { label: 'Left Wall', length: layout.plot.length, loadBearing: true },
    { label: 'Right Wall', length: layout.plot.length, loadBearing: true },
  ];

  // Detect large spans that need columns
  const largeSpans = layout.rooms.filter((r) => r.width > 16 || r.length > 16);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="size-4 text-primary" />
        <span className="text-sm font-semibold">Structural Analysis</span>
        <Badge variant="secondary" className="text-[9px]">STUDIO</Badge>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Load-Bearing Walls</p>
        {outerWalls.map((w) => (
          <div key={w.label} className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-200">
            <span className="text-xs">{w.label}</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-600" />
              <span className="text-[10px] tech-num">{w.length}ft</span>
            </div>
          </div>
        ))}
      </div>
      {largeSpans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Column Recommendations</p>
          {largeSpans.map((r, i) => (
            <div key={i} className="p-2 rounded bg-amber-50 border border-amber-200">
              <p className="text-xs">Room at ({r.x}', {r.y}') — span {r.width}×{r.length}ft</p>
              <p className="text-[10px] text-amber-700">⚠ Recommend RCC column at center (span {'>'} 16ft)</p>
            </div>
          ))}
        </div>
      )}
      <div className="p-2 rounded bg-muted/40 text-[10px] text-muted-foreground">
        Preliminary analysis only. Consult a licensed structural engineer for actual structural design.
      </div>
    </div>
  );
}

// ============ City Code Checker ============
export function CityCodeChecker({ plot, floors }: { plot: { width: number; length: number }; floors: number }) {
  const [city, setCity] = useState('bangalore');
  const cities = {
    bangalore: { name: 'Bangalore', fsi: 2.0, minSetback: 3, maxHeight: 12, parking: 1 },
    mumbai: { name: 'Mumbai', fsi: 1.5, minSetback: 2, maxHeight: 15, parking: 1 },
    chennai: { name: 'Chennai', fsi: 2.0, minSetback: 2, maxHeight: 12, parking: 1 },
    delhi: { name: 'Delhi', fsi: 2.0, minSetback: 3, maxHeight: 12, parking: 1 },
    pune: { name: 'Pune', fsi: 1.5, minSetback: 3, maxHeight: 12, parking: 1 },
  };
  const c = cities[city as keyof typeof cities];
  const plotArea = plot.width * plot.length;
  const allowedBuiltUp = plotArea * c.fsi;
  const proposedBuiltUp = plotArea * floors;
  const fsiUsed = (proposedBuiltUp / plotArea).toFixed(2);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="size-4 text-primary" />
        <span className="text-sm font-semibold">City Code Checker</span>
        <Badge variant="secondary" className="text-[9px]">STUDIO</Badge>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Select City</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(cities).map(([k, v]) => <SelectItem key={k} value={k}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Permitted FSI</span>
          <span className="text-xs font-semibold tech-num">{c.fsi}</span>
        </div>
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Your FSI Used</span>
          <span className={cn('text-xs font-semibold tech-num', Number(fsiUsed) > c.fsi ? 'text-red-600' : 'text-emerald-600')}>{fsiUsed}</span>
        </div>
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Allowed Built-up</span>
          <span className="text-xs font-semibold tech-num">{Math.round(allowedBuiltUp)} sq.ft</span>
        </div>
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Min Setback</span>
          <span className="text-xs font-semibold tech-num">{c.minSetback} ft</span>
        </div>
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Max Height</span>
          <span className="text-xs font-semibold tech-num">{c.maxHeight} m</span>
        </div>
        <div className="flex justify-between p-2 rounded bg-muted/30">
          <span className="text-xs">Min Parking</span>
          <span className="text-xs font-semibold tech-num">{c.parking} car(s)</span>
        </div>
      </div>
      <div className={cn('p-2 rounded text-[10px]', Number(fsiUsed) > c.fsi ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
        {Number(fsiUsed) > c.fsi
          ? `⚠ FSI exceeded! Your ${fsiUsed} > permitted ${c.fsi}. Reduce floors or plot area.`
          : `✓ FSI compliant. ${c.fsi - Number(fsiUsed)} FSI remaining.`}
      </div>
    </div>
  );
}

// ============ Feature Gate Component ============
export function FeatureGate({ tier, requiredTier, children, featureName }: {
  tier: PlanTier;
  requiredTier: PlanTier;
  children: React.ReactNode;
  featureName: string;
}) {
  const tierOrder = { starter: 0, pro: 1, studio: 2 };
  const hasAccess = tierOrder[tier] >= tierOrder[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-lg">
        <div className="text-center p-4">
          <Lock className="size-6 mx-auto mb-2 text-primary" />
          <p className="text-sm font-semibold mb-1">{featureName}</p>
          <p className="text-[10px] text-muted-foreground mb-3">Available in {requiredTier === 'pro' ? 'Pro' : 'Studio'} plan</p>
          <Button size="sm" className="gap-1.5">
            <Crown className="size-3.5" /> Upgrade to {requiredTier === 'pro' ? 'Pro' : 'Studio'}
          </Button>
        </div>
      </div>
    </div>
  );
}
