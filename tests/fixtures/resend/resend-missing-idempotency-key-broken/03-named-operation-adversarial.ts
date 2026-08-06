import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial against the generic-transport suppression: the body is
// caller-supplied but the subject is fixed, so this function does know which
// operation it performs — `password-reset/${userId}` is right there. It must
// still fire.
export async function sendPasswordReset(userId: string, email: string, body: string) {
  return resend.emails.send({
    from: 'Acme <security@acme.com>',
    to: [email],
    subject: 'Reset your password',
    html: body,
  });
}

// Caller-supplied subject, fixed body — the mirror case, also still named.
export async function sendAlert(email: string, subject: string) {
  return resend.emails.send({
    from: 'Acme <alerts@acme.com>',
    to: [email],
    subject,
    html: '<p>An alert fired on your account.</p>',
  });
}
