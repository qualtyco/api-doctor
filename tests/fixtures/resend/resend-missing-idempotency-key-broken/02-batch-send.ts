import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Batch send with no options object and therefore no idempotencyKey.
export async function sendReceipts(orders: { email: string }[]) {
  return resend.batch.send(
    orders.map((o) => ({
      from: 'Acme <receipts@acme.com>',
      to: [o.email],
      subject: 'Receipt',
      html: '<p>Receipt</p>',
    })),
  );
}
