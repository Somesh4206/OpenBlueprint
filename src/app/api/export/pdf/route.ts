import { NextRequest, NextResponse } from 'next/server';
import { CostEstimate, LayoutData, ProjectConfig } from '@/lib/types';
import { renderBlueprintSVG } from '@/lib/svg-renderer';
import { estimateCost, formatINR } from '@/lib/cost/estimator';
import { scoreLayout, validateLayout } from '@/lib/layout/engine';
import { ROOM_CATALOG } from '@/lib/room-catalog';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    layout: LayoutData;
    config: ProjectConfig;
    projectName: string;
    finish: 'basic' | 'standard' | 'premium' | 'luxury';
    materials: { flooring: string; doors: string; windows: string; finish: string };
    accentColor?: string;
  };

  const { layout, config, projectName, finish, materials, accentColor } = body;
  const svg = renderBlueprintSVG(layout, {
    blueprintMode: true,
    floor: 'all',
    padding: 48,
    scale: 16,
    accentColor,
  });
  const score = scoreLayout(layout, config);
  const validation = validateLayout(layout, config);
  const cost = estimateCost(layout, finish, materials as never);

  const html = buildPdfHtml({
    projectName,
    layout,
    config,
    svg,
    score,
    validation,
    cost,
    accentColor: accentColor || '#2b4a7a',
  });

  return NextResponse.json({ html, svg });
}

function buildPdfHtml(args: {
  projectName: string;
  layout: LayoutData;
  config: ProjectConfig;
  svg: string;
  score: ReturnType<typeof scoreLayout>;
  validation: ReturnType<typeof validateLayout>;
  cost: CostEstimate;
  accentColor: string;
}): string {
  const { projectName, layout, config, svg, score, validation, cost, accentColor } = args;
  const builtUp = layout.rooms.reduce((s, r) => s + r.width * r.length, 0);
  const roomsList = layout.rooms
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td>${ROOM_CATALOG[r.type].label}</td><td>${r.width}' × ${r.length}'</td><td>${Math.round(r.width * r.length)} sq.ft</td><td>Floor ${r.floor + 1}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>${projectName} — Blueprint</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2a3a; margin: 0; background: #fff; }
  .sheet { width: 100%; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${accentColor}; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${accentColor}; }
  .brand small { display:block; font-size: 10px; font-weight: 500; color: #5b6678; letter-spacing: 0.04em; text-transform: uppercase; }
  .title { font-size: 16px; font-weight: 700; }
  .meta { font-size: 10px; color: #5b6678; }
  .grid { display: grid; grid-template-columns: 1fr 280px; gap: 14px; }
  .canvas { background: #0f2742; border-radius: 8px; padding: 8px; }
  .canvas svg { width: 100%; height: auto; display:block; border-radius: 4px; }
  .panel { background: #f7f8fa; border:1px solid #e6e8ec; border-radius: 8px; padding: 12px; font-size: 11px; }
  .panel h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${accentColor}; margin: 0 0 8px 0; }
  .kv { display:flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #e0e3e8; }
  .kv:last-child { border-bottom: none; }
  .kv b { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
  th { text-align: left; background: ${accentColor}; color:#fff; padding: 5px 7px; font-weight: 600; }
  td { padding: 4px 7px; border-bottom: 1px solid #e6e8ec; }
  .scorebar { height:6px; background:#e6e8ec; border-radius: 3px; overflow:hidden; margin: 3px 0 6px; }
  .scorebar > div { height:100%; background: ${accentColor}; }
  .disclaimer { margin-top: 14px; padding: 10px; background: #fff8e6; border:1px solid #f0d875; border-radius: 6px; font-size: 9px; color: #6b5a1a; line-height: 1.4; }
  .cost { font-size: 22px; font-weight: 800; color: ${accentColor}; }
  .badge { display:inline-block; padding: 2px 8px; background: ${accentColor}; color:#fff; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .footer { margin-top: 12px; font-size: 9px; color: #9aa3b0; text-align: center; border-top: 1px solid #e6e8ec; padding-top: 8px; }
</style></head>
<body><div class="sheet">
  <div class="header">
    <div>
      <div class="brand">OpenBlueprint<small>From Measurements to Intelligent Blueprints</small></div>
    </div>
    <div style="text-align:right">
      <div class="title">${projectName}</div>
      <div class="meta">Plot ${layout.plot.width} × ${layout.plot.length} ${layout.plot.unit} · ${layout.floors} Floor(s) · ${new Date().toLocaleDateString()}</div>
      <div class="meta">Strategy: ${layout.strategy}</div>
    </div>
  </div>
  <div class="grid">
    <div class="canvas">${svg}</div>
    <div style="display:flex; flex-direction: column; gap: 10px;">
      <div class="panel">
        <h3>Area Summary</h3>
        <div class="kv"><span>Plot Area</span><b>${layout.plot.width * layout.plot.length} sq.ft</b></div>
        <div class="kv"><span>Built-up Area</span><b>${Math.round(builtUp)} sq.ft</b></div>
        <div class="kv"><span>Floors</span><b>${layout.floors}</b></div>
        <div class="kv"><span>Rooms</span><b>${layout.rooms.length}</b></div>
        <div class="kv"><span>Space Utilization</span><b>${score.spaceUtilization}%</b></div>
      </div>
      <div class="panel">
        <h3>Design Score · ${score.total}/100</h3>
        ${[
          ['Space Utilization', score.spaceUtilization],
          ['Circulation', score.circulation],
          ['Ventilation', score.ventilation],
          ['Requirement Match', score.requirementMatch],
          ['Dimension Validity', score.dimensionValidity],
        ]
          .map(
            ([l, v]) =>
              `<div style="font-size:10px;">${l} — ${v}%<div class="scorebar"><div style="width:${v}%"></div></div></div>`,
          )
          .join('')}
      </div>
      <div class="panel">
        <h3>Preliminary Cost Estimate</h3>
        <div class="cost">${formatINR(cost.total)}</div>
        <div class="meta">${cost.area} sq.ft @ ₹${cost.ratePerSqft}/sq.ft · ${finishLabel(cost.grade)}</div>
        <div style="margin-top:6px;">
          ${Object.entries(cost.breakdown)
            .map(
              ([k, v]) =>
                `<div class="kv"><span>${label(k)}</span><b>${formatINR(v as number)}</b></div>`,
            )
            .join('')}
        </div>
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Room</th><th>Type</th><th>Dimensions</th><th>Area</th><th>Floor</th></tr></thead>
    <tbody>${roomsList}</tbody>
  </table>
  <div class="disclaimer">
    <b>Disclaimer:</b> OpenBlueprint provides AI-assisted conceptual planning and preliminary design visualization.
    Generated layouts are not a substitute for professional architectural, structural, electrical, plumbing, or regulatory drawings.
    Cost figures are preliminary indicative estimates based on generic rates and actual costs will vary.
    Consult qualified professionals and verify applicable local regulations before construction.
    Validation status: ${validation.valid ? 'Preliminary checks passed' : 'Issues detected — ' + validation.errors.length + ' error(s)'}.
  </div>
  <div class="footer">Generated by OpenBlueprint · Preliminary Conceptual Design · ${new Date().toISOString()}</div>
</div></body></html>`;
}

function finishLabel(g: string): string {
  return ({ basic: 'Basic', standard: 'Standard', premium: 'Premium', luxury: 'Luxury' } as Record<string, string>)[g] || g;
}

function label(k: string): string {
  const m: Record<string, string> = {
    foundation: 'Foundation',
    structure: 'Structure',
    flooring: 'Flooring',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    doorsWindows: 'Doors & Windows',
    painting: 'Painting',
    other: 'Other',
  };
  return m[k] || k;
}
