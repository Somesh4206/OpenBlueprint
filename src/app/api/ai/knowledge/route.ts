import { NextRequest, NextResponse } from 'next/server';
import { answerKnowledgeQuestion } from '@/lib/ai/knowledge-base';

export async function POST(req: NextRequest) {
  const { question } = (await req.json()) as { question: string };
  const answer = await answerKnowledgeQuestion(question);
  return NextResponse.json(answer);
}
