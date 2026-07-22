import { chromium } from 'playwright';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function runTrajectory(projectId: string) {
  const session = await bb.sessions.create({ projectId });

  // If connectOverCDP throws, the session stays RUNNING on Browserbase's
  // side until its timeout — nothing here releases it.
  const browser = await chromium.connectOverCDP(session.connectUrl);
  return browser;
}
