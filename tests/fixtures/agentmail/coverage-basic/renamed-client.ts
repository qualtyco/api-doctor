import { AgentMailClient as MailSdk } from 'agentmail';

const client = new MailSdk({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendReply(inboxId: string, to: string) {
  await client.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Re: your request',
    text: 'On it — reply to this thread with any questions.',
  });
}
