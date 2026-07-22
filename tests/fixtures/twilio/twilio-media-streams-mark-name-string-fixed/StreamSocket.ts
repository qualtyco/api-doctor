type WebSocket = { send: (data: string) => void };

export function sendMark(socket: WebSocket, streamSid: string) {
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: String(Date.now()),
    },
  };
  socket.send(JSON.stringify(markMessage));
}
