import { NextRequest, NextResponse } from 'next/server';

// Validated once at module load — a missing key fails the build/deploy
// instead of only failing the first time a user hits this route.
const XI_API_KEY = process.env.XI_API_KEY;
if (!XI_API_KEY) {
  throw new Error('XI_API_KEY is not set');
}

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': XI_API_KEY } },
  );
  const data = await response.json();
  return NextResponse.json({ signedUrl: data.signed_url });
}
