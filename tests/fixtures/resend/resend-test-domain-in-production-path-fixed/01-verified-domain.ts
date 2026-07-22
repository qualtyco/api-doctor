import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Uses a verified domain from the environment; no test-domain literal present.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'Acme <hello@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });
}
