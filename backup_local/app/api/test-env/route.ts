import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasPerplexityKey: !!process.env.PERPLEXITY_API_KEY,
    keyPrefix: process.env.PERPLEXITY_API_KEY?.substring(0, 10) || 'NOT_SET',
    nodeEnv: process.env.NODE_ENV
  });
}