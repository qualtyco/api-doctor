import { Browserbase as HeadlessSdk } from '@browserbasehq/sdk';

const client = new HeadlessSdk({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startCheckout(projectId: string) {
  const session = await client.sessions.create({
    projectId,
    browserSettings: { blockAds: true },
  });
  return session.id;
}
