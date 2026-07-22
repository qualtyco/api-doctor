import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-tail-is-end-not-last-record';

describe('s2-tail-is-end-not-last-record rule', () => {
  it('flags both broken fixtures (unary read at tail, waitSecs:0 session at tail)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /tailOffset/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (last-N read, live follower without stop)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
