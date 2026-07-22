import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function liveViewHandler(req: Request, res: Response) {
  const { jobId } = req.params;
  const user = (req as any).user;

  // Anonymous requests skip this whole block instead of being rejected.
  if (user) {
    const execution = await lookupExecution(jobId);
    if (!hasOrgAccess(user, execution.organizationId)) {
      return res.status(404).json({ detail: 'Job not found' });
    }
    const links = await bb.sessions.debug(execution.sessionId);
    return res.json(links);
  }
}

declare function lookupExecution(jobId: string): Promise<{ organizationId: string; sessionId: string }>;
declare function hasOrgAccess(user: any, orgId: string): boolean;
