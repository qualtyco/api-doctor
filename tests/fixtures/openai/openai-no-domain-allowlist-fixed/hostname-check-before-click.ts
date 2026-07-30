const ALLOWED_DOMAINS = ['example.com', 'app.example.com'];

export async function executeComputerAction(page: any, action: { type: string; x: number; y: number }) {
  const host = new URL(page.url()).hostname;
  if (!ALLOWED_DOMAINS.includes(host)) {
    throw new Error(`Blocked action on disallowed domain: ${host}`);
  }

  if (action.type === 'click') {
    await page.mouse.click(action.x, action.y);
  }
}
