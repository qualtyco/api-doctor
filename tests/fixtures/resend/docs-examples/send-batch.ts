// docs-example-source: https://resend.com/docs/api-reference/emails/send-batch-emails
// Verbatim Node.js batch send example.
// Expected by design: the sample hardcodes a placeholder 're_' key, sends
// from the test-only onboarding@resend.dev address, and omits the
// idempotency key and tags that our advisory rules push users beyond the
// minimal quickstart toward.
// RULE-DISABLED 2026-07-28: resend/security/api-key-hardcoded is commented out
// in src/providers/resend/manifest.ts pre-launch, so it no longer fires here.
// docs-examples.test.ts asserts exact equality, so it is removed from the
// expected list below. Restore it (it IS a true positive on this sample — the
// key is hardcoded) in the same change that re-enables the rule.
// Was: resend/security/api-key-hardcoded, resend/correctness/test-domain-in-production-path, resend/reliability/missing-idempotency-key, resend/reliability/missing-tags
// docs-example-expected: resend/correctness/test-domain-in-production-path, resend/reliability/missing-idempotency-key, resend/reliability/missing-tags
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx');

const { data, error } = await resend.batch.send([
  {
    from: 'Acme <onboarding@resend.dev>',
    to: ['foo@gmail.com'],
    subject: 'hello world',
    html: '<h1>it works!</h1>',
  },
  {
    from: 'Acme <onboarding@resend.dev>',
    to: ['bar@outlook.com'],
    subject: 'world hello',
    html: '<p>it works!</p>',
  },
]);
