import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectConfig, ScoredLayout } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    project: {
      id: p.id,
      name: p.name,
      buildingType: p.buildingType,
      accentColor: p.accentColor,
      thumbnail: p.thumbnail,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      config: p.configData ? JSON.parse(p.configData) : null,
      layout: p.layoutData ? JSON.parse(p.layoutData) : null,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, config, design, accentColor } = body as {
    name?: string;
    config?: ProjectConfig;
    design?: ScoredLayout;
    accentColor?: string;
  };
  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (config) data.configData = JSON.stringify(config);
  if (design) data.layoutData = JSON.stringify(design.layout);
  if (accentColor) data.accentColor = accentColor;
  const project = await db.project.update({ where: { id }, data });
  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
