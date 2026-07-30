export async function runTurn(client: any, model: string, input: any[]) {
  try {
    const response = await client.responses.create({ model, input, tools: [{ type: 'computer' }] });
    return response;
  } catch (exc) {
    return { success: false, error: String(exc) };
  }
}
