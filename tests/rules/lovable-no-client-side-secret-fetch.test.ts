import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'lovable-no-client-side-secret-fetch';

describe('lovable-no-client-side-secret-fetch rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /VITE_/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (own Edge Function, and non-VITE proxy token)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
