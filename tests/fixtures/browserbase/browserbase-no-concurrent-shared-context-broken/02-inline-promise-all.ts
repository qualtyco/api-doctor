import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function runDeviceMatrix(devices: string[], contextId: string) {
  return Promise.all(
    devices.map((device) =>
      bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        browserSettings: { context: { id: contextId } },
      }),
    ),
  );
}
