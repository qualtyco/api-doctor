import OpenAI from 'openai';

// Distinct manifestation: navigation + a fill_sensitive_field-style action,
// instead of click/type, still with no origin check anywhere. The file
// verifiably drives a CUA loop (responses.create + computer tool +
// computer_call handling).
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function agentStep(page: any, previousCallId: string, screenshot: string) {
  const response = await openai.responses.create({
    model: 'computer-use-preview',
    tools: [{ type: 'computer_use_preview', display_width: 1280, display_height: 800, environment: 'browser' }],
    input: [
      {
        type: 'computer_call_output',
        call_id: previousCallId,
        output: { type: 'input_image', image_url: `data:image/png;base64,${screenshot}` },
      },
    ],
    truncation: 'auto',
  });

  const call = response.output.find((item: any) => item.type === 'computer_call');
  if (call?.action?.type === 'fill') {
    await fillSensitiveField(page, call.action);
  }
}

export async function fillSensitiveField(page: any, action: { url?: string; selector: string; value: string }) {
  if (action.url) {
    await page.goto(action.url);
  }
  await page.fill(action.selector, action.value);
}
