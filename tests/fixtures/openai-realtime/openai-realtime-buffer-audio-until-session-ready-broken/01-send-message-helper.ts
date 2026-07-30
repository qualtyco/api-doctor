import WebSocket from 'ws';

export const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

class AudioInterceptor {
  private logger: any;

  private sendMessageToOpenAI(socket: WebSocket, message: object) {
    if (socket.readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      socket.send(jsonMessage);
    } else {
      this.logger.error('WebSocket is not open. Unable to send message.');
    }
  }
}

export default AudioInterceptor;
