import { NextRequest, NextResponse } from 'next/server';
import { LayoutData } from '@/lib/types';
import { renderBlueprintSVG } from '@/lib/svg-renderer';

export async function POST(req: NextRequest) {
  const { layout, blueprintMode, floor } = (await req.json()) as {
    layout: LayoutData;
    blueprintMode?: boolean;
    floor?: number;
  };
  const svg = renderBlueprintSVG(layout, {
    blueprintMode: blueprintMode ?? false,
    floor: floor ?? 'all',
    padding: 48,
    scale: 16,
  });
  return NextResponse.json({ svg });
}
