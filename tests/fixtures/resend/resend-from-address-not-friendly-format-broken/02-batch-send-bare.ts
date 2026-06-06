import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Batch items also use a bare-email `from`.
export async function sendReceipts(orders: { email: string }[]) {
  return resend.batch.send([
    {
      from: 'receipts@acme.com',
      to: [orders[0].email],
      subject: 'Receipt',
      html: '<p>Receipt</p>',
    },
  ]);
}
