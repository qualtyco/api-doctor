export async function fetchSignedUrl(agentId: string | null, apiKey: string) {
  // Only an existence/length check — no format validation.
  if (agentId === null || agentId.length === 0) {
    throw new Error('Agent ID is required');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } },
  );
  return response.json();
}
