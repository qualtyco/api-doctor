export async function getDubbingStatus(dubbingId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbingId}`, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs request failed with status ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
