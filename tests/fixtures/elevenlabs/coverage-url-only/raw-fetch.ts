export async function synthesizeRaw(voiceId: string, text: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs request failed with status ${res.status}`);
    }
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}
