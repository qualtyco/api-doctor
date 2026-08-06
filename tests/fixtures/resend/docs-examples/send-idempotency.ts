// docs-example-source: https://resend.com/docs/dashboard/emails/idempotency-keys
// Verbatim Node.js idempotency-key example. The doc snippet assumes a
// pre-built `resend` client in scope.
// Expected by design: test-only from address, no tags, and a discarded result.
// The snippet is scoped to demonstrating the key, so it drops the { data, error }
// the send resolves to — Resend's own fuller examples (send-batch.ts,
// send-with-react.ts, send-route-app-router.ts) all destructure `error`, which
// is why they stay clean. Copied into a service as-is this fails silently, so
// the finding is correct rather than tolerated.
// docs-example-expected: resend/correctness/test-domain-in-production-path, resend/correctness/unchecked-send-error, resend/reliability/missing-tags
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
