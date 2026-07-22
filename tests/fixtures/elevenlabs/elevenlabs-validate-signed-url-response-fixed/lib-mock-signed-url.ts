import { NextResponse } from 'next/server';

// Local test/dev stub — not derived from a real ElevenLabs API response, so
// there is nothing to validate here even though it shares the field name.
export async function fetchSignedUrlStub() {
  const data = { signed_url: 'wss://api.elevenlabs.io/mock-signed-url' };
  return NextResponse.json({ signedUrl: data.signed_url });
}
