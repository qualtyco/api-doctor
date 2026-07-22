// Adversarial: an object literal with a `connectUrl` field exists, but it's
// only ever passed to internal logging/storage, never to a response-sending
// call — the credential never reaches an HTTP response body.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startSessionAndAudit() {
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID });

  auditLog.write({
    sessionId: session.id,
    connectUrl: session.connectUrl,
  });

  return session.id;
}

declare const auditLog: { write(entry: Record<string, unknown>): void };
