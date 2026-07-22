import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: the payload object has no idempotencyKey, but it is supplied in
// the second options argument — so the call is correct and must not be flagged.
export async function sendWelcome(email: string) {
  return resend.emails.send(
    {
      from: 'Acme <onboarding@acme.com>',
      to: [email],
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    },
    { idempotencyKey: `welcome/${email}` },
  );
}
