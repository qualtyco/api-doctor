type StreamSocket = { send: (messages: string[]) => void };

export function relayMediaPayload(socket: StreamSocket, payload: string[], streamSid: string) {
  if (!streamSid) throw new Error('StreamSid is required to relay media');
  socket.send(payload);
}
