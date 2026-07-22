import WebSocket from 'ws';

class AudioInterceptor {
  private pendingMessages: object[] = [];

  private sendMessageToOpenAI(socket: WebSocket, message: object) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      this.pendingMessages.push(message);
    }
  }
}

export default AudioInterceptor;
