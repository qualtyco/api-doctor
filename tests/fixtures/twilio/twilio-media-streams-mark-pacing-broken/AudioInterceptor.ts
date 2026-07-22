type StreamSocket = { send: (messages: string[], isLast?: boolean) => void };

export class AudioInterceptor {
  #agentSocket?: StreamSocket;
  #callerSocket?: StreamSocket;

  forwardToAgent(message: { delta: string }) {
    this.#agentSocket?.send([message.delta]);
  }

  forwardToCaller(message: { delta: string }) {
    this.#callerSocket?.send([message.delta]);
  }
}
