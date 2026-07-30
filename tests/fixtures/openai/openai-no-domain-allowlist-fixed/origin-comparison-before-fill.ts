// Looks like the broken shape at a glance (no variable literally named
// "allowlist"), but it does compare the live page's origin against the
// configured project origin before filling anything.
export async function fillSensitiveField(page: any, projectOrigin: string, selector: string, value: string) {
  const currentUrl = new URL(page.url());
  if (currentUrl.origin !== projectOrigin) {
    throw new Error('Refusing to fill a field on an unexpected origin');
  }
  await page.fill(selector, value);
}
