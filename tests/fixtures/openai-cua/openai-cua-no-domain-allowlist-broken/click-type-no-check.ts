export async function executeComputerAction(page: any, action: { type: string; x: number; y: number; text?: string }) {
  if (action.type === 'click') {
    await page.mouse.click(action.x, action.y);
  } else if (action.type === 'type') {
    await page.keyboard.type(action.text ?? '');
  }
}
