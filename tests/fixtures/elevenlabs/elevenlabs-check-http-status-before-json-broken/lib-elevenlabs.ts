export async function fetchSignedUrl(agentId: string, apiKey: string) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } },
  );

  // No response.ok / status check before parsing — an error body would be
  // returned to the caller as if it were a valid signed URL payload.
  return response.json();
}
