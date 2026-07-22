// A report read from disk has unknown size — anything over ~4.5 MB raw
// exceeds the 6 MB inline cap once base64-encoded, and the send fails.
import { readFile } from 'node:fs/promises';
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function emailReport(inboxId: string, to: string, path: string): Promise<void> {
  const data = await readFile(path);
  await client.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Monthly report',
    text: 'Report attached.',
    attachments: [
      {
        content: data.toString('base64'),
        filename: 'report.pdf',
        contentType: 'application/pdf',
      },
    ],
  });
}
