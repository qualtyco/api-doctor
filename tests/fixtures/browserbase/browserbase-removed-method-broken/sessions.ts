// 1.x flat-client calls on an installed 2.x resource client. The package name
// and the Browserbase constructor did not change, so nothing at the top of the
// file records the mismatch.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startRun() {
  const session = await bb.createSession({ projectId: process.env.BROWSERBASE_PROJECT_ID });
  const all = await bb.listSessions();
  return { session, all };
}

export async function finishRun(sessionId: string) {
  await bb.completeSession(sessionId);
  return bb.getSession(sessionId);
}
