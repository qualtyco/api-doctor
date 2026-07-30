import { test, expect } from '@playwright/test';

// False-positive regression (audit: 295/307 FPs): an ordinary Playwright
// test. page.goto/click/fill is Playwright's generic API — with no OpenAI
// computer-use evidence anywhere in the file, this must never be flagged
// for a missing domain allowlist.
test('user can sign in', async ({ page }) => {
  await page.goto('https://staging.example.com/login');
  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'hunter2');
  await page.click('button[type="submit"]');
  await expect(page.locator('.dashboard')).toBeVisible();
});
