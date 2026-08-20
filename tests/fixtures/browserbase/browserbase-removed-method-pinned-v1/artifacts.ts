import Browserbase from '@browserbasehq/sdk';

const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function collect(sessionId: string) {
  const logs = await browserbase.getSessionLogs(sessionId);
  const downloads = await browserbase.getSessionDownloads(sessionId, 2000, 5);
  return { logs, downloads };
}
