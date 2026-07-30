type WebSocket = { send: (data: string) => void };

export function sendSequencedMark(socket: WebSocket, streamSid: string) {
  if (!streamSid) throw new Error('StreamSid is required to send a mark');
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: 42,
    },
  };
  socket.send(JSON.stringify(markMessage));
}
