import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Tags present for segmentation.
export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${email}`,
    tags: [{ name: 'category', value: 'welcome' }],
  });
}
