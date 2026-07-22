import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function fetchRecording(sessionId: string) {
  return bb.sessions.recording.retrieve(sessionId);
}
