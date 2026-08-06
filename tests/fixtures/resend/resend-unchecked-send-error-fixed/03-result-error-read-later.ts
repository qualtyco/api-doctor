import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// The whole result is bound and `.error` read afterwards — including through a
// later destructure, which is the same check written differently.
export async function sendDigest(email: string, digestId: string) {
  const response = await resend.emails.send({
    from: 'Acme <digest@acme.com>',
    to: [email],
    subject: 'Your digest',
    html: '<p>Digest</p>',
    idempotencyKey: `digest/${digestId}`,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const contact = await resend.contacts.create({ email, audienceId: 'aud_1' });
  const { error } = contact;
  if (error) throw new Error(error.message);

  return response.data;
}
