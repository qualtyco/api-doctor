import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY!);
await resend.emails.send({
  from: 'Acme <a@acme.com>',
  to: 'u@x.com',
  subject: 'Hi',
  html: '<p>x</p>',
  tags: [{ name: 'c', value: 'welcome' }],
  idempotencyKey: 'welcome/1',
});
