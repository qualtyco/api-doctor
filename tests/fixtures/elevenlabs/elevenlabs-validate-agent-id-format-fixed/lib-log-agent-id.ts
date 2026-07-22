// Looks suspicious because agentId is only existence-checked, but it's never
// sent to the ElevenLabs API in this function — just used for local logging —
// so format validation isn't relevant here.
export function logRequestedAgent(agentId: string | null) {
  if (!agentId) {
    console.log('No agent id provided');
    return;
  }
  console.log('Agent requested:', agentId);
}
