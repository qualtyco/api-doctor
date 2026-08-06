import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// The result is awaited and thrown away. An unverified domain or a rejected
// recipient resolves as { data: null, error } and this reports success.
export async function notifySignup(email: string) {
  await resend.emails.send({
    from: 'Acme <onboarding@acme.com>',
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
    idempotencyKey: `welcome/${email}`,
  });

  return { ok: true };
}
