import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Bare email in `from`, no friendly display name.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: 'onboarding@acme.com',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });
}
