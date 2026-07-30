export async function runTurn(client: any, model: string, input: any[]) {
  const response = await client.responses.create({ model, input, tools: [{ type: 'computer' }] });

  if (response.status === 'incomplete') {
    return { success: false, completed: false, error: 'truncated by token budget' };
  }

  const computerCalls = (response.output ?? []).filter((item: any) => item.type === 'computer_call');
  if (computerCalls.length === 0) {
    return { success: true, completed: true, final_message: response.output_text ?? '' };
  }

  return { success: true, completed: false };
}
