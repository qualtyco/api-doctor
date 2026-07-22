// No-args create + fan-out loop: the campaign runs on @agentmail.to.
import { AgentMailClient } from 'agentmail';
import { newsletterRecipients } from './recipients.js';
import { sleep } from './util.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendNewsletter(issue: { subject: string; text: string }): Promise<void> {
  const inbox = await agentmail.inboxes.create();
  while (newsletterRecipients.length > 0) {
    const recipient = newsletterRecipients.shift()!;
    await agentmail.inboxes.messages.send(inbox.inboxId, {
      to: [recipient],
      subject: issue.subject,
      text: issue.text,
    });
    await sleep(1_000);
  }
}
