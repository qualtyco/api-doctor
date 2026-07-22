// Adversarial: still an OR-chain of `.includes(` checks feeding a cleanup
// call (looks like the same risky shape), but every literal is specific to
// a confirmed-ended state — none is a generic resource-name word.
export function handlePollError(pollError: unknown, sessionId: string) {
  const message = String(pollError).toLowerCase();
  if (message.includes('not found') || message.includes('410') || message.includes('404')) {
    console.warn(`Tearing down session ${sessionId} after confirmed-ended poll error`);
    cleanupSession(sessionId);
  }
}

declare function cleanupSession(sessionId: string): void;
