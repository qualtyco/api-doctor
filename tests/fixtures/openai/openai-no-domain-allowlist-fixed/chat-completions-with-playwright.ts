import OpenAI from 'openai';
import { chromium } from 'playwright';

// False-positive regression, second line of defense: the file imports and
// uses the OpenAI SDK (so file-level provider gating passes), but only for
// chat completions — there is no computer-use tool, model, or computer_call
// handling. The Playwright automation below is ordinary scraping, not a CUA
// action loop, and must not be flagged.
const openai = new OpenAI();

export async function summarizePage(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.click('#accept-cookies');
  const text = await page.innerText('main');
  await browser.close();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Summarize this page:\n\n${text}` }],
  });
  return completion.choices[0].message.content;
}
