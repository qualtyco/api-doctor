import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintPythonFixture } from '../helpers/lint-python-rule.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/resend');

describe('resend-api-key-hardcoded (python)', () => {
  it('flags hardcoded re_ keys', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-api-key-hardcoded-broken'), [
      'resend-api-key-hardcoded',
    ]);
    expect(diags.some((d) => d.ruleKey === 'resend-api-key-hardcoded')).toBe(true);
  });

  it('does not flag env-based keys', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-api-key-hardcoded-fixed'), [
      'resend-api-key-hardcoded',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-api-key-hardcoded')).toHaveLength(0);
  });
});

describe('resend-missing-idempotency-key (python)', () => {
  it('flags send without idempotency_key', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-missing-idempotency-key-broken'), [
      'resend-missing-idempotency-key',
    ]);
    expect(diags.some((d) => d.ruleKey === 'resend-missing-idempotency-key')).toBe(true);
  });

  it('allows send with idempotency_key', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-missing-idempotency-key-fixed'), [
      'resend-missing-idempotency-key',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-missing-idempotency-key')).toHaveLength(0);
  });
});

describe('resend-marketing-missing-unsubscribe (python)', () => {
  it('flags marketing-tagged sends without unsubscribe', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-marketing-missing-unsubscribe-broken'), [
      'resend-marketing-missing-unsubscribe',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-marketing-missing-unsubscribe').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag marketing-with-unsub or transactional sends', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-marketing-missing-unsubscribe-fixed'), [
      'resend-marketing-missing-unsubscribe',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-marketing-missing-unsubscribe')).toHaveLength(0);
  });
});

describe('resend-webhook-signature (python)', () => {
  it('flags POST webhook handlers that skip verification', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-webhook-signature-broken'), [
      'resend-webhook-signature',
    ]);
    expect(diags.some((d) => d.ruleKey === 'resend-webhook-signature')).toBe(true);
  });

  it('allows verify-first handlers and ignores stringified examples', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-webhook-signature-fixed'), [
      'resend-webhook-signature',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-webhook-signature')).toHaveLength(0);
  });
});

describe('resend-webhook-no-idempotency (python)', () => {
  it('flags svix POST handlers without dedup', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-webhook-no-idempotency-broken'), [
      'resend-webhook-no-idempotency',
    ]);
    expect(diags.some((d) => d.ruleKey === 'resend-webhook-no-idempotency')).toBe(true);
  });

  it('allows deduped handlers and non-handler files', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-webhook-no-idempotency-fixed'), [
      'resend-webhook-no-idempotency',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-webhook-no-idempotency')).toHaveLength(0);
  });
});

describe('resend-batch-size-not-enforced (python)', () => {
  it('flags unguarded variable batch arrays', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-batch-size-not-enforced-broken'), [
      'resend-batch-size-not-enforced',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-batch-size-not-enforced').length).toBeGreaterThanOrEqual(2);
  });

  it('skips literal arrays, length guards, and chunking loops', () => {
    const diags = lintPythonFixture(join(fixtures, 'resend-batch-size-not-enforced-fixed'), [
      'resend-batch-size-not-enforced',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'resend-batch-size-not-enforced')).toHaveLength(0);
  });
});
