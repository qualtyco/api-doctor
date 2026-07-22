export async function fetchSignedUrl(agentId: string, apiKey: string) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } },
    );
    return await response.json();
  } catch (error) {
    console.warn({ error });
    throw error;
  }
}
