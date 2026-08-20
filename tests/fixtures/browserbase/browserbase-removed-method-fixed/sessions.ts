import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startRun() {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });
  const all = await bb.sessions.list();
  return { session, all, connectUrl: session.connectUrl };
}

export async function finishRun(sessionId: string) {
  await bb.sessions.update(sessionId, {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    status: 'REQUEST_RELEASE',
  });
  return bb.sessions.retrieve(sessionId);
}
