import { NextRequest, NextResponse } from 'next/server';
import { answerKnowledgeQuestion } from '@/lib/ai/knowledge-base';
import { serverAIConfig } from '@/lib/ai/provider';

export async function POST(req: NextRequest) {
  const { question } = (await req.json()) as { question: string };
  const answer = await answerKnowledgeQuestion(question, serverAIConfig(req.headers));
  return NextResponse.json(answer);
}
