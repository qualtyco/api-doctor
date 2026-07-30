import OpenAI from 'openai';

const client = new OpenAI();
const ALLOWED_DOMAINS = ['example.com', 'app.example.com'];

// Same CUA loop as the broken fixture, but the action executor checks the
// live page's hostname against an allowlist before acting.
export async function runComputerUseTurn(page: any, screenshotBase64: string) {
  const response = await client.responses.create({
    model: 'computer-use-preview',
    tools: [{ type: 'computer_use_preview', display_width: 1024, display_height: 768, environment: 'browser' }],
    input: [{ role: 'user', content: [{ type: 'input_image', image_url: `data:image/png;base64,${screenshotBase64}` }] }],
    truncation: 'auto',
  });

  for (const item of response.output) {
    if (item.type === 'computer_call') {
      await executeComputerAction(page, item.action);
    }
  }
}

export async function executeComputerAction(page: any, action: { type: string; x: number; y: number }) {
  const host = new URL(page.url()).hostname;
  if (!ALLOWED_DOMAINS.includes(host)) {
    throw new Error(`Blocked action on disallowed domain: ${host}`);
  }

  if (action.type === 'click') {
    await page.mouse.click(action.x, action.y);
  }
}
