// docs-example-source: https://resend.com/docs/send-with-nextjs
// Verbatim "React email template" example from the AI-prompt section.
// Expected by design: test-only from address, no idempotency key, no tags.
// docs-example-expected: resend/correctness/test-domain-in-production-path, resend/reliability/missing-idempotency-key, resend/reliability/missing-tags
import { Resend } from 'resend';
import { WelcomeEmail } from './emails/welcome';

const resend = new Resend('YOUR_RESEND_API_KEY');

const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['delivered@resend.dev'],
  subject: 'Welcome',
  react: WelcomeEmail({ name: 'John' }),
});
