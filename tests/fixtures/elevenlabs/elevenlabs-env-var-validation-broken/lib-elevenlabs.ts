export async function fetchSignedUrl(agentId: string) {
  const buildHeaders = () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
    return { 'xi-api-key': apiKey };
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    { headers: buildHeaders() },
  );
  return response.json();
}
