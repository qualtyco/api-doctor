// Looks suspicious because "error" appears right next to the ElevenLabs
// fetch call, but only error.message (a string) is ever logged — never the
// raw error object — so there is nothing sensitive being written here.
export async function fetchSignedUrl(agentId: string, apiKey: string) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } },
    );
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('elevenlabs request failed:', message);
    throw new Error(message);
  }
}
