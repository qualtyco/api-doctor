export function createConversationSessionId(): string {
  const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return sessionId;
}
