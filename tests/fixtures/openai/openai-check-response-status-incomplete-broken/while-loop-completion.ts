// Distinct manifestation: a while-loop driven agent turn, completion
// signaled by `completed: true` instead of `success: true`, still no
// response.status check anywhere.
import OpenAI from 'openai';

export async function runAgentLoop(client: OpenAI, model: string, initialInput: any[]) {
  let input = initialInput;
  while (true) {
    const response = await client.responses.create({ model, input });
    const hasToolCall = (response.output ?? []).some((item: any) => item.type === 'computer_call');
    if (!hasToolCall) {
      return { completed: true, finalMessage: response.output_text };
    }
    input = [];
  }
}
