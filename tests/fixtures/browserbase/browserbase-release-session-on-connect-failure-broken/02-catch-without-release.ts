import { chromium } from 'playwright';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function runTrajectory(projectId: string) {
  const session = await bb.sessions.create({ projectId });

  try {
    const browser = await chromium.connectOverCDP(session.connectUrl);
    return browser;
  } catch (err) {
    // Logs the failure but never releases the Browserbase session.
    console.error('connect failed', err);
    throw err;
  }
}
