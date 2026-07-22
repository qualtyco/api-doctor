import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function createSessionWithRetry(projectId: string) {
  let attempt = 0;
  while (attempt < 3) {
    try {
      return await bb.sessions.create({ projectId, browserSettings: {} });
    } catch (err) {
      attempt += 1;
      if (attempt >= 3) throw err;
    }
  }
}
