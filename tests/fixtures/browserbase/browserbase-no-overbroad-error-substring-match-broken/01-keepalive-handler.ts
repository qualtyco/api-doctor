export function handleKeepaliveError(keepaliveError: unknown, sessionId: string) {
  const errStr = String(keepaliveError).toLowerCase();
  if (errStr.includes('not found') || errStr.includes('404') || errStr.includes('session')) {
    console.log(`[RECORDER] Browserbase session gone (keep-alive error): ${keepaliveError}; releasing slot`);
    releaseSlotAndRemoveSession(sessionId);
    return false;
  }
  return true;
}

declare function releaseSlotAndRemoveSession(sessionId: string): void;
