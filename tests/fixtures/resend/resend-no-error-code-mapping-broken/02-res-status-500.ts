import { Resend } from 'resend';
import type { NextApiRequest, NextApiResponse } from 'next';

const resend = new Resend(process.env.RESEND_API_KEY);

// Pages Router handler returning res.status(500) for any Resend error.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.body;

  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${email}`,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ id: data?.id });
}
