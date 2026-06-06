import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Marketing-tagged email with no unsubscribe header and no placeholder in HTML.
export async function sendPromo(email: string) {
  return resend.emails.send({
    from: 'Acme <news@acme.com>',
    to: [email],
    subject: 'Big Summer Sale',
    html: '<h1>50% off everything</h1><p>You opted in.</p>',
    tags: [{ name: 'category', value: 'marketing' }],
  });
}
