// Looks like the broken shape if you only skim the success branch near the
// bottom — the status check is an early guard near the top of the function,
// far from where "success: true" is returned, but it still covers it.
export async function runTurn(client: any, model: string, input: any[]) {
  const response = await client.responses.create({ model, input });

  if (response.status === 'incomplete') {
    throw new Error(`Turn truncated: ${response.incomplete_details?.reason}`);
  }

  const items = response.output ?? [];
  const hasToolCall = items.some((item: any) => item.type === 'computer_call' || item.type === 'function_call');

  if (!hasToolCall) {
    return { success: true, completed: true, final_message: response.output_text ?? '' };
  }

  return { success: true, completed: false };
}
