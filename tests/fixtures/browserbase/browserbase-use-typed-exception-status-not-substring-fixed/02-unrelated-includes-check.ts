// Adversarial: a catch block uses `.includes(` (looks like the same risky
// shape), but on a config string unrelated to the caught error — not a
// substring match against the error's own message/stringification.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

const FEATURE_FLAGS = process.env.FEATURE_FLAGS ?? '';

export async function getLiveViewLinks(sessionId: string) {
  try {
    return await bb.sessions.debug(sessionId);
  } catch (error: any) {
    if (FEATURE_FLAGS.includes('verbose-errors')) {
      console.error('Live view fetch failed', error);
    }
    if (error.status === 404) {
      return { ended: true };
    }
    throw error;
  }
}
