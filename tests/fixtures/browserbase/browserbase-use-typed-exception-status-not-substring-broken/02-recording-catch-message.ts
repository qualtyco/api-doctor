import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function getRecording(sessionId: string) {
  try {
    return await bb.sessions.recording.retrieve(sessionId);
  } catch (err) {
    if (err.message.toLowerCase().includes('404') || err.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw err;
  }
}
