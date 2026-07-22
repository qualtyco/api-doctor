import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'auth0-dead-claim-verification-check';

describe('auth0-dead-claim-verification-check rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /includes/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (direct boolean check, and literal "true" substring check)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'auth0')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
