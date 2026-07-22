// Looks suspicious because Math.random() appears right next to conversation
// setup code, but it only picks a UI variant (inbound vs outbound demo
// agent) — it never feeds into a session id, so unpredictability isn't a
// security concern here.
export function pickInitialAgentType(): 'inbound' | 'outbound' {
  const agentType = Math.random() < 0.5 ? 'inbound' : 'outbound';
  return agentType;
}
