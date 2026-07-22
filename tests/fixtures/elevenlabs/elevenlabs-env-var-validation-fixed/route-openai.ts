import { NextRequest, NextResponse } from 'next/server';

// Looks suspicious because an API key is only read inside the handler with
// no module-scope validation, but it's OPENAI_API_KEY, not an ElevenLabs
// key — out of scope for this rule.
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
  }
  const body = await request.json();
  return NextResponse.json({ received: body });
}
