// Downloaded content attached inline on the drafts surface — same unknown
// size, same 6 MB inline cap.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function draftWithDownload(inboxId: string, to: string, fileUrl: string) {
  const res = await fetch(fileUrl);
  const bytes = await res.arrayBuffer();
  return agentmail.inboxes.drafts.create(inboxId, {
    to: [to],
    subject: 'Requested file',
    text: 'File attached.',
    clientId: `file-${encodeURIComponent(fileUrl)}`,
    attachments: [
      {
        content: Buffer.from(bytes).toString('base64'),
        filename: 'download.bin',
      },
    ],
  });
}
