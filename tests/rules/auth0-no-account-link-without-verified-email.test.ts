import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'auth0-no-account-link-without-verified-email';

describe('auth0-no-account-link-without-verified-email rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /email_verified/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (plain verified gate, and namespaced claim gate)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
