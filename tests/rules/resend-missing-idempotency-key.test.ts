import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-missing-idempotency-key';

describe('resend-missing-idempotency-key rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /idempotencyKey/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (key in payload, and in options arg)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
