import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ProjectConfig, ScoredLayout } from '@/lib/types';

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  const parsed = projects.map((p) => ({
    id: p.id,
    name: p.name,
    buildingType: p.buildingType,
    accentColor: p.accentColor,
    thumbnail: p.thumbnail,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    config: p.configData ? JSON.parse(p.configData) : null,
    layout: p.layoutData ? JSON.parse(p.layoutData) : null,
  }));
  return NextResponse.json({ projects: parsed });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, buildingType, config, design } = body as {
    name: string;
    buildingType?: string;
    config: ProjectConfig;
    design?: ScoredLayout;
  };
  const project = await db.project.create({
    data: {
      name: name || 'Untitled Project',
      buildingType: buildingType || 'residential',
      configData: JSON.stringify(config),
      layoutData: design ? JSON.stringify(design.layout) : null,
      accentColor: '#2b4a7a',
    },
  });
  return NextResponse.json({ project });
}
