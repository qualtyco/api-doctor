import Browserbase from '@browserbasehq/sdk';

export const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

export function handlePollError(pollError: unknown, sessionId: string) {
  const message = String(pollError).toLowerCase();
  if (message.includes('gone') || message.includes('context')) {
    console.warn(`Tearing down session ${sessionId} after poll error`);
    cleanupSession(sessionId);
  }
}

declare function cleanupSession(sessionId: string): void;
