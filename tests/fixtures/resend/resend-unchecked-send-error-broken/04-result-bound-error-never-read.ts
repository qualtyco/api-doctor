import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

declare function track(event: string, id?: string): void;

// The whole result is bound, but only `.data` is ever touched.
export async function sendDigest(email: string, digestId: string) {
  const result = await resend.emails.send({
    from: 'Acme <digest@acme.com>',
    to: [email],
    subject: 'Your digest',
    html: '<p>Digest</p>',
    idempotencyKey: `digest/${digestId}`,
  });

  track('digest.sent', result.data?.id);
  return result.data;
}
