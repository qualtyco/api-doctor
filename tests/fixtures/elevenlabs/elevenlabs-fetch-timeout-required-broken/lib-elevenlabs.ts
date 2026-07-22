export async function pingElevenLabsHealth() {
  // No options object at all — and therefore no signal.
  const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url');
  return response.ok;
}
