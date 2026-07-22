import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcome(email: string) {
  try {
    await resend.emails.send({
      from: 'Acme <onboarding@acme.com>',
      to: [email],
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    });
  } catch (error: any) {
    console.error('Failed to send:', error.message);
  }
}
