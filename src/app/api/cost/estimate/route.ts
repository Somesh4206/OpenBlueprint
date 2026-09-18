import { NextRequest, NextResponse } from 'next/server';
import { FinishGrade, LayoutData, MaterialSelection } from '@/lib/types';
import { estimateCost } from '@/lib/cost/estimator';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    layout: LayoutData;
    finish: FinishGrade;
    materials: MaterialSelection;
  };
  const estimate = estimateCost(body.layout, body.finish, body.materials);
  return NextResponse.json({ estimate });
}
