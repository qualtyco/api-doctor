import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifySignup(email: string) {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${email}`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
