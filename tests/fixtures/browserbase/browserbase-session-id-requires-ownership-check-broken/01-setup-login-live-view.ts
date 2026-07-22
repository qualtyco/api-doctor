import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function setupLoginLiveViewHandler(req: Request, res: Response) {
  const sessionId = req.params.sessionId;
  const links = await bb.sessions.debug(sessionId);
  res.json(links);
}
