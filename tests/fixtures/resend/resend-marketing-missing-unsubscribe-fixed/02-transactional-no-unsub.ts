import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: a transactional welcome email with no unsubscribe mechanism.
// Transactional mail is not marketing, so the absence is correct and must not
// be flagged.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome to Acme',
    html: '<p>Welcome aboard!</p>',
    tags: [{ name: 'category', value: 'welcome' }],
  });
}
