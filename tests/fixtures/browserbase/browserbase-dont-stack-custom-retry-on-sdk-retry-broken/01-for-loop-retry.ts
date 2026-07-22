import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function createSessionWithRetry(projectId: string, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await bb.sessions.create({ projectId });
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      await sleep(2 ** attempt * 1000);
    }
  }
}

declare function sleep(ms: number): Promise<void>;
