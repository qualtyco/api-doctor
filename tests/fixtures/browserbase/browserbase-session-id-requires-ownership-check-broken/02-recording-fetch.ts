import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function recordingHandler(req: Request, res: Response) {
  const { session_id: sessionId } = req.query as { session_id: string };
  const recording = await bb.sessions.recording.retrieve(sessionId);
  res.json(recording);
}
