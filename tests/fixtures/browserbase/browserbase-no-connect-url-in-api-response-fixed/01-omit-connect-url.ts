import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function startSetupLoginSession(req: Request, res: Response) {
  const session = await bb.sessions.create({ projectId: process.env.BROWSERBASE_PROJECT_ID });
  const liveViewLinks = await bb.sessions.debug(session.id);

  // connectUrl intentionally omitted — server-side only, used internally by connectAndNavigate().
  res.json({
    sessionId: session.id,
    liveViewUrl: liveViewLinks.debuggerFullscreenUrl,
  });
}
