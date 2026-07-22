export async function runTurn(client: any, model: string, input: any[]) {
  return client.responses.create({
    model,
    input,
    tools: [{ type: 'computer' }],
  });
}
