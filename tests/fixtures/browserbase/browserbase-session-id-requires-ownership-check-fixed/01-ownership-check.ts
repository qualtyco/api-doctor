import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function setupLoginLiveViewHandler(req: Request, res: Response) {
  const sessionId = req.params.sessionId;
  const user = (req as any).user;

  const profile = await findOwnerOfSession(sessionId);
  if (!profile || profile.userId !== user.id) {
    return res.status(404).json({ detail: 'Session not found' });
  }

  const links = await bb.sessions.debug(sessionId);
  res.json(links);
}

declare function findOwnerOfSession(sessionId: string): Promise<{ userId: string } | null>;
