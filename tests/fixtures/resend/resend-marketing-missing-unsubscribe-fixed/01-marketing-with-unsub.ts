import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Marketing email that includes the unsubscribe placeholder in its HTML.
export async function sendPromo(email: string) {
  return resend.emails.send({
    from: 'Acme <news@acme.com>',
    to: [email],
    subject: 'Big Summer Sale',
    html: '<h1>50% off</h1><footer>{{{RESEND_UNSUBSCRIBE_URL}}}</footer>',
    headers: {
      'List-Unsubscribe': '<https://acme.com/unsubscribe>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [{ name: 'category', value: 'marketing' }],
  });
}
