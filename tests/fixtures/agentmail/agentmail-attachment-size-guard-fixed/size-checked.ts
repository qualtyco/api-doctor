// Correct: the payload size is checked against the inline cap, falling
// back to the url attachment (30 MB) for larger files.
import { readFile } from 'node:fs/promises';
import { AgentMailClient } from 'agentmail';
import { uploadToBucket } from './storage.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const INLINE_LIMIT = 6 * 1024 * 1024; // 6 MB cap on base64 content

export async function emailReport(inboxId: string, to: string, path: string): Promise<void> {
  const data = await readFile(path);
  const encoded = data.toString('base64');
  const attachment =
    encoded.length > INLINE_LIMIT
      ? { url: await uploadToBucket(path), filename: 'report.pdf' }
      : { content: encoded, filename: 'report.pdf', contentType: 'application/pdf' };
  await client.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Monthly report',
    text: 'Report attached.',
    attachments: [attachment],
  });
}
