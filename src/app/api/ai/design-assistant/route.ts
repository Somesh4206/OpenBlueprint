import { NextRequest, NextResponse } from 'next/server';
import { LayoutData, ProjectConfig } from '@/lib/types';
import { interpretDesignRequest } from '@/lib/ai/design-assistant';
import { serverAIConfig } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    message: string;
    layout: LayoutData;
    config: ProjectConfig;
    floor?: number;
  };
  const response = await interpretDesignRequest(
    body.message,
    body.layout,
    body.config,
    serverAIConfig(req.headers),
    typeof body.floor === 'number' ? body.floor : 0,
  );
  return NextResponse.json({ response });
}
