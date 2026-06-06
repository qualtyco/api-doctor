import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Falls back to the test domain when the env var is unset — risky in prod.
function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
}

export async function sendNotification(email: string) {
  return resend.emails.send({
    from: fromAddress(),
    to: [email],
    subject: 'Notification',
    html: '<p>Update</p>',
  });
}
