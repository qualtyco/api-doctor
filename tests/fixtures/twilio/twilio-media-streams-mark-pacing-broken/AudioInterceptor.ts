type StreamSocket = { send: (messages: string[], isLast?: boolean) => void };

export class AudioInterceptor {
  #agentSocket?: StreamSocket;
  #callerSocket?: StreamSocket;

  attachSockets(agent: StreamSocket, caller: StreamSocket, streamSid: string) {
    if (!streamSid) throw new Error('StreamSid is required for Twilio media streams');
    this.#agentSocket = agent;
    this.#callerSocket = caller;
  }

  forwardToAgent(message: { delta: string }) {
    this.#agentSocket?.send([message.delta]);
  }

  forwardToCaller(message: { delta: string }) {
    this.#callerSocket?.send([message.delta]);
  }
}
