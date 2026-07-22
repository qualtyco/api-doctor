import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'firebase-rtdb-batch-write-not-atomic';

describe('firebase-rtdb-batch-write-not-atomic rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'firebase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /not atomic/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (atomic update, and push-free map)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'firebase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
