import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Only `data` is destructured, so `data.id` throws a TypeError on the failure
// path instead of surfacing the real reason.
export async function sendReceipt(email: string, orderId: string) {
  const { data } = await resend.emails.send({
    from: 'Acme <receipts@acme.com>',
    to: [email],
    subject: 'Receipt',
    html: '<p>Thanks</p>',
    idempotencyKey: `receipt/${orderId}`,
  });

  return data!.id;
}
