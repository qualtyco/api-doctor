import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'webhook-signature');

describe('scan', () => {
  it('flags the 3 broken Resend webhook signature fixtures', async () => {
    const { results } = await scan(fixturesDir);
    const hits = results.filter((r) => r.rule === 'resend/webhook-signature-missing');
    expect(hits).toHaveLength(3);

    const hitFiles = hits.map((h) => h.file.split('/').pop()).sort();
    const expected = [
      'resend-broken-no-verify.ts',
      'resend-broken-late-verify.ts',
      'resend-broken-comment-only.ts',
    ].sort();

    expect(hitFiles).toEqual(expected);
    for (const h of hits) {
      expect(h.line).toBeGreaterThan(0);
      expect(h.snippet.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not flag any of the 4 correct fixtures for the webhook-signature rule', async () => {
    const { results } = await scan(fixturesDir);
    // Scope to the webhook-signature rule: other rules (e.g. webhook idempotency)
    // may legitimately flag these handlers for unrelated reasons.
    const hitFiles = results
      .filter((r) => r.rule === 'resend/webhook-signature-missing')
      .map((r) => r.file.split('/').pop());
    const correct = [
      'resend-ok-verify-first.ts',
      'resend-ok-renamed-import.ts',
      'resend-ok-non-resend-webhook.ts',
      'resend-ok-string-literal.ts',
    ];
    for (const f of correct) {
      expect(hitFiles).not.toContain(f);
    }
  });
});
