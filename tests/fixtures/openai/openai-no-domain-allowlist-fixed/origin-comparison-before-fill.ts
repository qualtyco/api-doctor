import OpenAI from 'openai';

// Looks like the broken shape at a glance (no variable literally named
// "allowlist"), but it does compare the live page's origin against the
// configured project origin before filling anything.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function agentStep(page: any, projectOrigin: string, screenshot: string) {
  const response = await openai.responses.create({
    model: 'computer-use-preview',
    tools: [{ type: 'computer_use_preview', display_width: 1280, display_height: 800, environment: 'browser' }],
    input: [{ role: 'user', content: [{ type: 'input_image', image_url: `data:image/png;base64,${screenshot}` }] }],
    truncation: 'auto',
  });

  const call = response.output.find((item: any) => item.type === 'computer_call');
  if (call?.action?.type === 'fill') {
    await fillSensitiveField(page, projectOrigin, call.action.selector, call.action.value);
  }
}

export async function fillSensitiveField(page: any, projectOrigin: string, selector: string, value: string) {
  const currentUrl = new URL(page.url());
  if (currentUrl.origin !== projectOrigin) {
    throw new Error('Refusing to fill a field on an unexpected origin');
  }
  await page.fill(selector, value);
}
