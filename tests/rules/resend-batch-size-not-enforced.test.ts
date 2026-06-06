import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-batch-size-not-enforced';

describe('resend-batch-size-not-enforced rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /100-email limit/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (length guard, and a chunking loop)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
