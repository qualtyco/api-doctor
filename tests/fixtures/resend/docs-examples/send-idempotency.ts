// docs-example-source: https://resend.com/docs/dashboard/emails/idempotency-keys
// Verbatim Node.js idempotency-key example. The doc snippet assumes a
// pre-built `resend` client in scope.
// Expected by design: test-only from address, no tags.
// docs-example-expected: resend/correctness/test-domain-in-production-path, resend/reliability/missing-tags
import { resend } from './lib/resend';

await resend.emails.send(
  {
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'hello world',
    html: '<p>it works!</p>',
  },
  {
    idempotencyKey: 'welcome-user/123456789',
  },
);
