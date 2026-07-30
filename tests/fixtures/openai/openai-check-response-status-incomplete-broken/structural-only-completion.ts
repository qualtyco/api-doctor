import OpenAI from 'openai';

export async function runTurn(client: OpenAI, model: string, input: any[]) {
  const response = await client.responses.create({ model, input, tools: [{ type: 'computer' }] });

  const computerCalls = (response.output ?? []).filter((item: any) => item.type === 'computer_call');
  const functionCalls = (response.output ?? []).filter((item: any) => item.type === 'function_call');

  if (computerCalls.length === 0 && functionCalls.length === 0) {
    return { success: true, completed: true, final_message: response.output_text ?? '' };
  }

  return { success: true, completed: false };
}
