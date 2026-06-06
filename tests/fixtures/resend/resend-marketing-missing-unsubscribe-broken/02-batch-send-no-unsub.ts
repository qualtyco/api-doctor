import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Newsletter-tagged batch items, none carrying an unsubscribe mechanism.
export async function sendNewsletter() {
  return resend.batch.send([
    {
      from: 'Acme <news@acme.com>',
      to: ['a@example.com'],
      subject: 'This week at Acme',
      html: '<p>Newsletter content</p>',
      tags: [{ name: 'type', value: 'newsletter' }],
    },
    {
      from: 'Acme <news@acme.com>',
      to: ['b@example.com'],
      subject: 'This week at Acme',
      html: '<p>Newsletter content</p>',
      tags: [{ name: 'type', value: 'newsletter' }],
    },
  ]);
}
