import { Resend } from 'resend';

// Adversarial: looks suspicious but is correct.
// Example key format documented for reference: re_123abcDEF (this is a comment,
// not a string literal, so it must NOT be flagged).
const resend = new Resend(process.env.RESEND_API_KEY);

// `pre_release` contains the substring "re_release" but is not a Resend key.
const featureFlag = 'pre_release_emails';

export async function sendWelcome(email: string) {
  if (featureFlag === 'pre_release_emails') {
    return resend.emails.send({
      from: 'Acme <onboarding@acme.com>',
      to: [email],
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    });
  }
}
