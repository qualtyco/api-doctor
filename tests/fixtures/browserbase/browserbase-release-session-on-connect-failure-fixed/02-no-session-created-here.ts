// Adversarial: this function connects to an externally-provided connectUrl —
// it never calls sessions.create() itself, so there's no session for this
// function to leak or release.
import { chromium } from 'playwright';

export async function attachToExistingSession(connectUrl: string) {
  const browser = await chromium.connectOverCDP(connectUrl);
  return browser;
}
