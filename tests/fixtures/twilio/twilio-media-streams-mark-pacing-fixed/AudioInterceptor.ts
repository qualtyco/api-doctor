type StreamSocket = { send: (messages: string[], isLast?: boolean) => void };

export class AudioInterceptor {
  #agentSocket?: StreamSocket;
  #chunkCount = 0;

  forwardToAgent(message: { delta: string }) {
    this.#chunkCount += 1;
    const isLast = this.#chunkCount % 20 === 0;
    this.#agentSocket?.send([message.delta], isLast);
  }
}
