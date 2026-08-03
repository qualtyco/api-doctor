// A Media Streams protocol file: speaks Twilio's wire format over a raw
// WebSocket. No SDK import, no distinctive string literal — the only evidence
// is the `streamSid` fields it reads and writes (identifier-position
// evidence, `identifierPattern` in the twilio anchor). The numeric mark name
// below is a real wire-protocol bug the gate must not silence.
export class StreamSocket {
  public streamSid: string;
  private ws: { send(data: string): void };

  constructor(ws: { send(data: string): void }, sid: string) {
    this.ws = ws;
    this.streamSid = sid;
  }

  sendMark() {
    this.ws.send(
      JSON.stringify({
        event: 'mark',
        streamSid: this.streamSid,
        mark: { name: Date.now() },
      }),
    );
  }
}
