// Adversarial: the file is read from disk (looks like inline-attachment
// material) but is uploaded and attached by url — the 30 MB path, no
// inline cap involved. Must not be flagged.
import { readFile } from 'node:fs/promises';
import { AgentMailClient } from 'agentmail';
import { uploadToBucket } from './storage.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function emailLargeExport(inboxId: string, to: string, path: string): Promise<void> {
  const data = await readFile(path);
  const url = await uploadToBucket(path, data);
  await agentmail.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Your data export',
    text: 'Export attached via link.',
    attachments: [{ url, filename: 'export.zip' }],
  });
}
