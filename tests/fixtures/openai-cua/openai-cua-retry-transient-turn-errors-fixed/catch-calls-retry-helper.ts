// Looks like the broken shape (no surrounding loop), but the catch block
// delegates to a dedicated retry helper instead of ending the run directly.
export async function runTurn(client: any, model: string, input: any[]) {
  try {
    return await client.responses.create({ model, input });
  } catch (exc) {
    return retryTurnWithBackoff(client, model, input, exc);
  }
}

async function retryTurnWithBackoff(client: any, model: string, input: any[], lastError: unknown) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return client.responses.create({ model, input });
}
