import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-scoped-token-for-client';

describe('s2-scoped-token-for-client rule', () => {
  it('flags both broken fixtures (use-client bundle, token in response)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /scoped token/i.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (scoped token issue, server-only client)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
