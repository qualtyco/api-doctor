import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'auth0-required-audience-validation';

describe('auth0-required-audience-validation rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /audience/i.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (explicit audience, and fail-closed audience)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
