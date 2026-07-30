import { Resend } from 'resend';

// Real-world Resend key shape: `re_` + key id + random base62 token, hiding
// in an env-style fallback expression. Deliberately kept just short enough
// that GitHub push protection's length threshold doesn't mistake this
// fabricated fixture for a live credential.
const resend = new Resend(process.env.RESEND_API_KEY ?? 're_bQx7_K9mT4wPzR2vHs');

export async function sendReceipt(to: string, receiptHtml: string) {
  return resend.emails.send({
    from: 'Acme <billing@acme.com>',
    to: [to],
    subject: 'Your receipt',
    html: receiptHtml,
  });
}
