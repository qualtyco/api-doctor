type StreamSocket = { send: (messages: string[]) => void };

// Looks suspicious because there's no `isLast`/mark argument passed to
// send() here, but this file happens to also contain an unrelated `isLast`
// (pagination cursor) elsewhere — the rule is intentionally conservative
// and treats any `isLast` signal in the file as "don't flag" rather than
// risk a false positive, per the audit's "mostly non-rule" guidance.
export function relayMediaPayload(socket: StreamSocket, payload: string[]) {
  socket.send(payload);
}

export function isFinalPage(pageIndex: number, totalPages: number) {
  const isLast = pageIndex === totalPages - 1;
  return isLast;
}
