// Adversarial: a for-loop exists in this function (looks like the same
// suspicious shape), but sessions.create() itself sits outside it — there is
// no custom retry wrapping the call, just the SDK's own default retry.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function createSessionThenWarmCombos(projectId: string, combos: string[]) {
  const session = await bb.sessions.create({ projectId });

  for (const combo of combos) {
    console.log(`warming combo ${combo} for session ${session.id}`);
  }

  return session;
}
