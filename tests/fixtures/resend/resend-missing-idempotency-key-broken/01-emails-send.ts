import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// No idempotencyKey on a transactional send.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });
}
