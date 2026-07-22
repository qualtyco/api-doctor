import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');
  const apiKey = process.env.XI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'XI_API_KEY is not set' }, { status: 500 });
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } },
  );
  const data = await response.json();
  return NextResponse.json({ signedUrl: data.signed_url });
}
