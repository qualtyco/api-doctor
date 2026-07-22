import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function getLiveViewLinks(sessionId: string) {
  try {
    return await bb.sessions.debug(sessionId);
  } catch (error: any) {
    if (error.status === 404 || error.status === 410) {
      return { ended: true };
    }
    throw error;
  }
}
