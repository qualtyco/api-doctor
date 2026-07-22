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
    // Adversarial: uses the alternate header spelling `x-resend-request-id`,
    // which must also satisfy the rule.
    console.error('Failed to send:', error.message, error.headers?.['x-resend-request-id']);
  }
}
