import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'firebase-rtdb-write-promise-not-handled';

describe('firebase-rtdb-write-promise-not-handled rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'firebase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /neither awaited/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (try/catch, and passthrough return)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'firebase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
