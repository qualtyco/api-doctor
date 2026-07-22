import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Builds a batch from a mapped array but never checks its length.
export async function sendReceipts(orders: { email: string }[]) {
  const messages = orders.map((o) => ({
    from: 'Acme <receipts@acme.com>',
    to: [o.email],
    subject: 'Receipt',
    html: '<p>Receipt</p>',
  }));

  return resend.batch.send(messages);
}
