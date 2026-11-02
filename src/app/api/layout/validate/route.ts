import { NextRequest, NextResponse } from 'next/server';
import { LayoutData, ProjectConfig } from '@/lib/types';
import { validateLayout } from '@/lib/layout/engine';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { layout: LayoutData; config: ProjectConfig };
  const result = validateLayout(body.layout, body.config);
  return NextResponse.json({ validation: result });
}
