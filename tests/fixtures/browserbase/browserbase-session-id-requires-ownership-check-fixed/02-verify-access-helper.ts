// Adversarial: the ownership check is named differently than the audit's
// example (verifyAccess instead of a findOwner-style lookup), still matches
// the rule's ownership-check naming heuristic, and correctly precedes use.
import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function recordingHandler(req: Request, res: Response) {
  const { session_id: sessionId } = req.query as { session_id: string };
  const user = (req as any).user;

  await verifyAccess(user, sessionId);

  const recording = await bb.sessions.recording.retrieve(sessionId);
  res.json(recording);
}

declare function verifyAccess(user: any, sessionId: string): Promise<void>;
