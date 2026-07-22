import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'browserbase-session-id-requires-ownership-check';

describe('browserbase-session-id-requires-ownership-check rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /ownership check/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (findOwner check, and verifyAccess helper)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
