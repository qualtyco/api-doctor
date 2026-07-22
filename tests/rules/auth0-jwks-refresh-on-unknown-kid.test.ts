import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'auth0-jwks-refresh-on-unknown-kid';

describe('auth0-jwks-refresh-on-unknown-kid rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /retry-with-forced-refresh|forced refresh/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (retry on miss, and always-fresh single call)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
