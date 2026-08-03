// Regression: a real send failure swallowed inside a higher-order wrapper.
// The rule reports on the CatchClause; the gate's enclosing-call fallback must
// not walk out of the handler function and attribute the finding to
// `internalAction(...)` — whose callee is on every provider's non-client list.
import { AgentMailClient } from 'agentmail';
import { internalAction } from './_generated/server.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! });

export const sendFollowups = internalAction({
  handler: async (args: { inboxId: string; to: string }) => {
    try {
      await client.inboxes.messages.send({
        inboxId: args.inboxId,
        to: args.to,
        subject: 'Following up',
        text: 'Just checking in.',
      });
    } catch {
      /* silently fail */
    }
  },
});
