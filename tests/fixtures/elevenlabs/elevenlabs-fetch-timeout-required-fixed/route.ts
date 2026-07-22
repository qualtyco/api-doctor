import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');
  const apiKey = process.env.XI_API_KEY;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey ?? '' },
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    const data = await response.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } finally {
    clearTimeout(timeoutId);
  }
}
