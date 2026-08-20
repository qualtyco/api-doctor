import Browserbase from '@browserbasehq/sdk';

const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function collect(sessionId: string) {
  const logs = await browserbase.sessions.logs.list(sessionId);
  const recording = await browserbase.sessions.recording.retrieve(sessionId);
  const downloads = await browserbase.sessions.downloads.list(sessionId);
  const debug = await browserbase.sessions.debug(sessionId);
  return { logs, recording, downloads, debug };
}
