import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Production sender hardcoded to the test-only domain.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: 'onboarding@resend.dev',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });
}
