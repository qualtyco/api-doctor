import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: `from` is not a string literal but a computed value, so the
// friendly-format heuristic cannot judge it and must not flag.
function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'Acme <hello@acme.com>';
}

export async function sendWelcome(email: string) {
  return resend.emails.send({
    from: fromAddress(),
    to: [email],
    subject: 'Welcome',
    html: '<p>Welcome</p>',
  });
}
