import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// A batch literal where an item is missing tags.
export async function sendReceipts() {
  return resend.batch.send([
    {
      from: 'Acme <receipts@acme.com>',
      to: ['a@example.com'],
      subject: 'Receipt',
      html: '<p>Receipt</p>',
      tags: [{ name: 'type', value: 'receipt' }],
    },
    {
      from: 'Acme <receipts@acme.com>',
      to: ['b@example.com'],
      subject: 'Receipt',
      html: '<p>Receipt</p>',
    },
  ]);
}
