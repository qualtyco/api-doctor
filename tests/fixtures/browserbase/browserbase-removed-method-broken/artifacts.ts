import Browserbase from '@browserbasehq/sdk';

const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function collect(sessionId: string) {
  const logs = await browserbase.getSessionLogs(sessionId);
  const recording = await browserbase.getSessionRecording(sessionId);
  // 1.x polled for this; 2.x issues a single request.
  const downloads = await browserbase.getSessionDownloads(sessionId, 2000, 5);
  const debug = await browserbase.getDebugConnectionURLs(sessionId);
  return { logs, recording, downloads, debug };
}

export function connectUrl(sessionId: string) {
  // No successor at all in 2.x — the URL comes back on the session object.
  return browserbase.getConnectURL({ sessionId });
}
