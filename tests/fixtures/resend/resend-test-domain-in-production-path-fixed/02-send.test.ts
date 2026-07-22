import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: this is a test file (`.test.ts`). Using the test domain here is
// expected, so the rule must skip it.
export async function sendTestEmail() {
  return resend.emails.send({
    from: 'onboarding@resend.dev',
    to: ['delivered@resend.dev'],
    subject: 'Test',
    html: '<p>Test</p>',
  });
}
