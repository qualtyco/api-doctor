// Identical code to the broken fixture, on a project pinned to 1.5.0. Correct
// against what is installed, so the rule stays silent forever.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startRun() {
  const session = await bb.createSession({ projectId: process.env.BROWSERBASE_PROJECT_ID });
  const all = await bb.listSessions();
  return { session, all };
}
