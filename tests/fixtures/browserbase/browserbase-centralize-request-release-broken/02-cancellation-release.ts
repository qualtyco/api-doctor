import Browserbase from '@browserbasehq/sdk';

export async function cancelJob(sessionId: string, projectId: string, apiKey: string) {
  const bb = new Browserbase({ apiKey });
  try {
    await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE', projectId });
  } catch (err) {
    console.warn('release failed', err);
  }
}
