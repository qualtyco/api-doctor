import { Resend as MailSdk } from 'resend';

const r = new MailSdk(process.env.RESEND_API_KEY);

export async function sendWelcome(to: string) {
  await r.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to,
    subject: 'Welcome',
    html: '<p>Welcome aboard!</p>',
    idempotencyKey: `welcome/${to}`,
    tags: [{ name: 'category', value: 'welcome' }],
  });
}
