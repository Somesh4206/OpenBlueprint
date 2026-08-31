import { NextRequest, NextResponse } from 'next/server';
import { LayoutData, ProjectConfig } from '@/lib/types';
import { interpretDesignRequest } from '@/lib/ai/design-assistant';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    message: string;
    layout: LayoutData;
    config: ProjectConfig;
  };
  const response = await interpretDesignRequest(body.message, body.layout, body.config);
  return NextResponse.json({ response });
}
