import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Transactional batch (order receipts) — a legitimate use of batch.send.
export async function sendReceipts(orders: { email: string; total: number }[]) {
  return resend.batch.send(
    orders.map((o) => ({
      from: 'Acme <receipts@acme.com>',
      to: [o.email],
      subject: 'Your receipt',
      html: `<p>Total: ${o.total}</p>`,
    })),
  );
}
