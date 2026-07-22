// Looks suspicious because there's no literal version header at the call
// site, but sharedHeaders is spread in and always carries the pinned
// elevenlabs-version header, so the version is actually pinned.
const sharedHeaders = {
  'xi-api-key': process.env.XI_API_KEY ?? '',
  'elevenlabs-version': '2026-06-01',
};

export async function fetchSignedUrl(agentId: string) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: { ...sharedHeaders } },
  );
  return response.json();
}
