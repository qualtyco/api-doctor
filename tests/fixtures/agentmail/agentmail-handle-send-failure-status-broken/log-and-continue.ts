// gtm shape: a suppressed prospect (403) is logged, left queued, and
// retried on every poll — burning an LLM call per attempt.
import { AgentMailClient } from 'agentmail';
import { generateColdEmail } from './llm.js';
import { prospects } from './prospects.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendFirstTouch(inboxId: string, email: string): Promise<void> {
  const body = await generateColdEmail(email);
  try {
    await client.inboxes.messages.send(inboxId, {
      to: [email],
      subject: 'Quick question',
      text: body,
    });
    prospects.updateProspect(email, { status: 'first_touch_sent' });
  } catch (err) {
    // BUG: 403 (suppressed recipient) is permanent — this retries it forever.
    console.error('send failed, will retry next poll', err);
  }
}
