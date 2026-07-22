export async function runTurn(client: any, model: string, input: any[]) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await client.responses.create({ model, input, tools: [{ type: 'computer' }] });
    } catch (exc) {
      if (attempt === maxAttempts - 1) {
        return { success: false, error: String(exc) };
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}
