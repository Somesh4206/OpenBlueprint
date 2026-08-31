import { NextRequest, NextResponse } from 'next/server';
import { ProjectConfig } from '@/lib/types';
import { generateDesignOptions } from '@/lib/layout/engine';

export async function POST(req: NextRequest) {
  const config = (await req.json()) as ProjectConfig;
  const designs = generateDesignOptions(config);
  return NextResponse.json({ designs });
}
