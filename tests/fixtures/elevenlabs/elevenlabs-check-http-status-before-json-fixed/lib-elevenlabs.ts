// Looks suspicious because it doesn't use the common `!response.ok` form,
// but checking response.status against the expected code is an equally
// valid guard before parsing the body.
export async function fetchSignedUrl(agentId: string, apiKey: string) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { 'xi-api-key': apiKey } },
  );

  if (response.status !== 200) {
    throw new Error(`Unexpected status: ${response.status}`);
  }

  return response.json();
}
