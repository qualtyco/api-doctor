import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

function browserSettingsForDevice(device: string) {
  const settings: any = { viewport: { width: 1280, height: 800 } };

  if (device === 'mobile') {
    settings.viewport = { width: 375, height: 667 };
    settings.os = 'mobile';
  }

  return settings;
}

export async function createComboSession(device: string) {
  return bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserSettings: browserSettingsForDevice(device),
  });
}
