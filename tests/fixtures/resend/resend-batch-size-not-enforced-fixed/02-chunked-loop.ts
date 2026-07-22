import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: no explicit `.length` check on the argument, but the send runs
// inside a chunking loop where each chunk is sized to the limit. Skipped.
export async function sendAll(messages: unknown[]) {
  const chunks: unknown[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await resend.batch.send(chunk);
  }
}
