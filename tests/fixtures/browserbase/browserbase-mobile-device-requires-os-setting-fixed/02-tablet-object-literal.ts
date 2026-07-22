// Adversarial: the device branch is "tablet", not literally "mobile" — still
// a real device-emulation combo, set via an inline object-literal `os` key
// rather than an assignment.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function createComboSession(device: string) {
  const viewport = device === 'tablet' ? { width: 810, height: 1080 } : { width: 1280, height: 800 };

  return bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserSettings: {
      viewport,
      os: 'tablet',
    },
  });
}
