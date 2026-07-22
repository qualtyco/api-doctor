import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'lovable-expiry-column-never-checked';

describe('lovable-expiry-column-never-checked rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /never compared/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (inline comparison, and filter-call read)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'lovable')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
