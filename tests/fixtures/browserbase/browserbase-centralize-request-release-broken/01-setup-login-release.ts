import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function endSetupLoginSession(sessionId: string, projectId: string) {
  try {
    await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE', projectId });
  } catch (err) {
    console.error('failed to release session', err);
  }
}
