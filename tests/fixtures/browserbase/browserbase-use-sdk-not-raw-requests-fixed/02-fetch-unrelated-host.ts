// Adversarial: a raw fetch() call exists (looks like the same risky shape),
// but it targets the site under test, not a Browserbase API endpoint.
export async function pingTargetSite(targetUrl: string) {
  const resp = await fetch(targetUrl, { method: 'HEAD' });
  return resp.ok;
}
