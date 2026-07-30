import OpenAI from 'openai';

export async function runTurn(client: OpenAI, model: string, input: any[]) {
  return client.responses.create({
    model,
    input,
    tools: [{ type: 'computer' }],
  });
}
