import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'browserbase-use-typed-exception-status-not-substring';

describe('browserbase-use-typed-exception-status-not-substring rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /err\.status/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (status check, and unrelated includes check)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
