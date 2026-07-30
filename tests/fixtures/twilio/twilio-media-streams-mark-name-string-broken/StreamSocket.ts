type WebSocket = { send: (data: string) => void };

export function sendMark(socket: WebSocket, streamSid: string) {
  if (!streamSid) throw new Error('StreamSid is required to send a mark');
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: Date.now(),
    },
  };
  socket.send(JSON.stringify(markMessage));
}
