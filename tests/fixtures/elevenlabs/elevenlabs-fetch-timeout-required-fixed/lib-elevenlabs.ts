// Looks suspicious because there's no literal `signal:` property in the call
// site, but the shared `baseRequestOptions` already carries an abort signal
// and is spread into every request, so the timeout is actually applied.
function buildBaseRequestOptions(apiKey: string) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5000);
  return { headers: { 'xi-api-key': apiKey }, signal: controller.signal };
}

export async function fetchSignedUrl(agentId: string, apiKey: string) {
  const baseRequestOptions = buildBaseRequestOptions(apiKey);
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { ...baseRequestOptions, method: 'GET' },
  );
  return response.json();
}
