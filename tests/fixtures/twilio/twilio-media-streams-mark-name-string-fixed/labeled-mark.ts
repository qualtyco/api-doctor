type WebSocket = { send: (data: string) => void };

// Looks suspicious because `name` isn't wrapped in String(...) here, but
// `label` is already a string (built above), so mark.name is correctly a
// string at runtime — the rule conservatively doesn't flag bare identifiers
// since it can't statically prove their type either way.
export function sendLabeledMark(socket: WebSocket, streamSid: string, chunkIndex: number) {
  const label = `chunk-${chunkIndex}`;
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: label,
    },
  };
  socket.send(JSON.stringify(markMessage));
}
