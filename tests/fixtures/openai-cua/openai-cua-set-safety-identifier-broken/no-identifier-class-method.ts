// Distinct manifestation: a class method using `this.client`/`this.model`,
// still no safety_identifier or user param.
export class CuaAgent {
  client: any;
  model: string;

  async executeTurn(messages: any[]) {
    return this.client.responses.create({
      model: this.model,
      input: messages,
    });
  }
}
