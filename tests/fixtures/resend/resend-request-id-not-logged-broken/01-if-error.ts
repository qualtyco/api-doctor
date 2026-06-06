import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcome(email: string) {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });

  if (error) {
    // Logs the message but not the request id — hard to trace with support.
    console.error('Resend error:', error.message);
    return { ok: false };
  }

  return { ok: true, id: data?.id };
}
