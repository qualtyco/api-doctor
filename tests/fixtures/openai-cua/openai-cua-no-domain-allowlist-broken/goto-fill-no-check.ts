// Distinct manifestation: navigation + a fill_sensitive_field-style action,
// instead of click/type, still with no origin check anywhere.
export async function fillSensitiveField(page: any, action: { url?: string; selector: string; value: string }) {
  if (action.url) {
    await page.goto(action.url);
  }
  await page.fill(action.selector, action.value);
}
