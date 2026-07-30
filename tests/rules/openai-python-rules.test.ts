import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintPythonFixture } from '../helpers/lint-python-rule.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/openai');

describe('openai-no-domain-allowlist (python)', () => {
  it('flags page actions with no origin/allowlist check', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-no-domain-allowlist-broken'), [
      'openai-no-domain-allowlist',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-no-domain-allowlist').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag actions guarded by a hostname/allowlist check', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-no-domain-allowlist-fixed'), [
      'openai-no-domain-allowlist',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-no-domain-allowlist')).toHaveLength(0);
  });
});

describe('openai-scroll-delta-default-zero (python)', () => {
  it('flags a non-zero default for a missing vertical scroll delta', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-scroll-delta-default-zero-broken'), [
      'openai-scroll-delta-default-zero',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-scroll-delta-default-zero').length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('does not flag a zero default or unrelated deltas', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-scroll-delta-default-zero-fixed'), [
      'openai-scroll-delta-default-zero',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-scroll-delta-default-zero')).toHaveLength(0);
  });
});

describe('openai-structured-step-metadata-not-text-json (python)', () => {
  it('flags brace-hunting JSON extraction from free text', () => {
    const diags = lintPythonFixture(
      join(fixtures, 'openai-structured-step-metadata-not-text-json-broken'),
      ['openai-structured-step-metadata-not-text-json'],
    );
    expect(
      diags.filter((d) => d.ruleKey === 'openai-structured-step-metadata-not-text-json').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag structured tool output or whole-string parsing', () => {
    const diags = lintPythonFixture(
      join(fixtures, 'openai-structured-step-metadata-not-text-json-fixed'),
      ['openai-structured-step-metadata-not-text-json'],
    );
    expect(diags.filter((d) => d.ruleKey === 'openai-structured-step-metadata-not-text-json')).toHaveLength(0);
  });
});

describe('openai-no-blind-safety-check-ack (python)', () => {
  it('flags a filter/comprehension that never inspects .code or .message', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-no-blind-safety-check-ack-broken'), [
      'openai-no-blind-safety-check-ack',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-no-blind-safety-check-ack').length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('does not flag a filter/comprehension that evaluates code/message', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-no-blind-safety-check-ack-fixed'), [
      'openai-no-blind-safety-check-ack',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-no-blind-safety-check-ack')).toHaveLength(0);
  });
});

describe('openai-retry-transient-turn-errors (python)', () => {
  it('flags a responses.create() try/except with no turn-level retry', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-retry-transient-turn-errors-broken'), [
      'openai-retry-transient-turn-errors',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-retry-transient-turn-errors').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a retry loop or a catch that calls a retry helper', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-retry-transient-turn-errors-fixed'), [
      'openai-retry-transient-turn-errors',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-retry-transient-turn-errors')).toHaveLength(0);
  });
});

describe('openai-check-response-status-incomplete (python)', () => {
  it('flags a completion check that never checks response.status', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-check-response-status-incomplete-broken'), [
      'openai-check-response-status-incomplete',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'openai-check-response-status-incomplete').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a completion check that verifies response.status first', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-check-response-status-incomplete-fixed'), [
      'openai-check-response-status-incomplete',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-check-response-status-incomplete')).toHaveLength(0);
  });
});

describe('openai-set-safety-identifier (python)', () => {
  it('flags responses.create() with no safety_identifier/user kwarg', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-set-safety-identifier-broken'), [
      'openai-set-safety-identifier',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-set-safety-identifier').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag safety_identifier or the legacy user kwarg', () => {
    const diags = lintPythonFixture(join(fixtures, 'openai-set-safety-identifier-fixed'), [
      'openai-set-safety-identifier',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'openai-set-safety-identifier')).toHaveLength(0);
  });
});
