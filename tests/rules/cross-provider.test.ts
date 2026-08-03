/**
 * Cross-provider firing contract: a provider's rules fire only on calls that
 * belong to that provider — never on another SDK's calls in the same file,
 * and never in files with no evidence of the provider at all.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintFileForRule } from '../helpers/lint-rule.js';

const fixture = (dir: string, file: string) =>
  join(__dirname, '..', 'fixtures', 'cross-provider', dir, file);

const mixed = fixture('mixed-file', 'multi-sdk-service.ts');
const wrapper = fixture('wrapper-import', 'send-invite.ts');
const plain = fixture('no-provider', 'plain-service.ts');

describe('mixed-provider file: each rule fires only on its own provider’s calls', () => {
  it('twilio await-or-catch flags the twilio call, not browserbase/stripe calls in the same handler', () => {
    const diags = lintFileForRule('twilio-await-or-catch-rest-calls-in-event-handlers', mixed);
    expect(diags.length, 'exactly the one twilioClient.calls.create').toBe(1);
    expect(diags[0].message).toMatch(/calls/);
  });

  it('resend missing-idempotency-key flags only the resend send', () => {
    const diags = lintFileForRule('resend-missing-idempotency-key', mixed);
    expect(diags.length).toBe(1);
  });

  it('supabase single-without-error-check flags only the supabase query', () => {
    const diags = lintFileForRule('supabase-single-without-error-check', mixed);
    expect(diags.length).toBe(1);
  });

  it('browserbase rules do not flag stripe.checkout.sessions.create', () => {
    // dont-stack-custom-retry / centralize-request-release key off
    // sessions.create/update shapes; stripe's checkout.sessions.create must
    // not be attributed to Browserbase.
    for (const key of [
      'browserbase-dont-stack-custom-retry-on-sdk-retry',
      'browserbase-centralize-request-release',
    ]) {
      const diags = lintFileForRule(key, mixed);
      for (const d of diags) {
        expect(d.message, `${key} must not fire on the stripe call`).not.toMatch(/stripe/i);
      }
    }
  });
});

describe('wrapper imports keep their provider attribution (no false negatives)', () => {
  it('resend missing-idempotency-key still flags a send through a wrapper-imported client', () => {
    const diags = lintFileForRule('resend-missing-idempotency-key', wrapper);
    expect(diags.length).toBe(1);
  });
});

describe('file with no provider evidence: nothing may fire', () => {
  const mustStaySilent = [
    // Used to fire on ANY catch block doing err.message.includes(...).
    'browserbase-use-typed-exception-status-not-substring',
    // Used to fire on ANY `const userId = '...'` literal.
    'firebase-hardcoded-user-id',
    // Used to fire on ANY x.emails.send(...) shape (the mailer facade here).
    'resend-missing-idempotency-key',
    'resend-missing-tags',
  ];

  for (const key of mustStaySilent) {
    it(`${key} stays silent`, () => {
      expect(lintFileForRule(key, plain)).toEqual([]);
    });
  }
});
