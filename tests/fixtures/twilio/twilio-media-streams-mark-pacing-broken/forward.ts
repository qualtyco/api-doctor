type StreamSocket = { send: (messages: string[]) => void };

export function relayMediaPayload(socket: StreamSocket, payload: string[]) {
  socket.send(payload);
}
