import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Newsletter blast (marketing) implemented with the transactional batch API.
export async function sendNewsletter(subscribers: { email: string }[]) {
  return resend.batch.send(
    subscribers.map((s) => ({
      from: 'Acme <news@acme.com>',
      to: [s.email],
      subject: 'This week at Acme',
      html: '<p>Newsletter content</p>',
    })),
  );
}
