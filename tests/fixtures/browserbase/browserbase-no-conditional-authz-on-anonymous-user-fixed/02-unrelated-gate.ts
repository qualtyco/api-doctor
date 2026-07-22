// Adversarial: a truthy `if (user) {...}` block exists (looks like the same
// suspicious shape), but it only toggles analytics — the sensitive call is
// unconditional, reached only after an early unconditional guard.
import type { Request, Response } from 'express';
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

export async function liveViewHandler(req: Request, res: Response) {
  const { jobId } = req.params;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ detail: 'Unauthorized' });
  }

  if (user) {
    trackAnalyticsEvent('live_view_requested', user.id);
  }

  const execution = await lookupExecution(jobId);
  if (!hasOrgAccess(user, execution.organizationId)) {
    return res.status(404).json({ detail: 'Job not found' });
  }

  const links = await bb.sessions.debug(execution.sessionId);
  return res.json(links);
}

declare function trackAnalyticsEvent(name: string, userId: string): void;
declare function lookupExecution(jobId: string): Promise<{ organizationId: string; sessionId: string }>;
declare function hasOrgAccess(user: any, orgId: string): boolean;
