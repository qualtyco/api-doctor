// Adversarial: same Promise.all(items.map(...)) batching shape, but no
// Context is configured at all — there's nothing to share across sessions.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function runAnonymousComboBatch(devices: string[]) {
  return Promise.all(
    devices.map((device) =>
      bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        browserSettings: { viewport: { width: 1280, height: 800 } },
      }),
    ),
  );
}
