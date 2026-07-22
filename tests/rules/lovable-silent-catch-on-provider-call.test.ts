import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'lovable-silent-catch-on-provider-call';

describe('lovable-silent-catch-on-provider-call rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /no key configured/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (console.error, and error-tracker report)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
