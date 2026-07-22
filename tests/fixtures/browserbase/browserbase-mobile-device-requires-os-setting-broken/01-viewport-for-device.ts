import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

function viewportForDevice(device: string) {
  if (device === 'mobile') {
    return { width: 375, height: 667 };
  }
  return { width: 1280, height: 800 };
}

export async function createComboSession(device: string) {
  const viewport = viewportForDevice(device);
  return bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserSettings: { viewport },
  });
}
