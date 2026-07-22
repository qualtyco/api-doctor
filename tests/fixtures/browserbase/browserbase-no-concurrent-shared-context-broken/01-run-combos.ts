import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function runComboBatch(combos: Array<{ device: string; browser: string }>, browserbaseContextId: string) {
  const sessionWrites = combos.map((combo) => {
    return bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        context: { id: browserbaseContextId },
        viewport: { width: 1280, height: 800 },
      },
    });
  });

  return Promise.all(sessionWrites);
}
