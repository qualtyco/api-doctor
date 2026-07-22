type WebSocket = { send: (data: string) => void };

export function sendSequencedMark(socket: WebSocket, streamSid: string) {
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: 42,
    },
  };
  socket.send(JSON.stringify(markMessage));
}
