export async function fetchSignedUrl(agentId: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } },
  );

  const data = await response.json();
  const signedUrl = data.signed_url;
  return signedUrl;
}
