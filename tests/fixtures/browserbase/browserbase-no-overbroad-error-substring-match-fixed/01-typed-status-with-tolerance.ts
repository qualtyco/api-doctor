export function handleKeepaliveError(keepaliveError: any, sessionId: string, consecutiveErrors: number) {
  if (keepaliveError?.status === 404 || keepaliveError?.status === 410) {
    console.log(`Browserbase session ${sessionId} confirmed gone (status ${keepaliveError.status})`);
    releaseSlotAndRemoveSession(sessionId);
    return false;
  }
  if (consecutiveErrors >= 3) {
    releaseSlotAndRemoveSession(sessionId);
    return false;
  }
  return true;
}

declare function releaseSlotAndRemoveSession(sessionId: string): void;
