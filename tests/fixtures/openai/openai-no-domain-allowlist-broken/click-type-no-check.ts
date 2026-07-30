import OpenAI from 'openai';

const client = new OpenAI();

// A real computer-use loop: responses.create with the computer_use_preview
// tool, computer_call output items dispatched to a page-action executor
// that never checks the page origin against an allowlist.
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

export async function executeComputerAction(page: any, action: { type: string; x: number; y: number; text?: string }) {
  if (action.type === 'click') {
    await page.mouse.click(action.x, action.y);
  } else if (action.type === 'type') {
    await page.keyboard.type(action.text ?? '');
  }
}
