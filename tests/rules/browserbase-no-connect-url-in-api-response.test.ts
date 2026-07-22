import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'browserbase-no-connect-url-in-api-response';

describe('browserbase-no-connect-url-in-api-response rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /connectUrl/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (omitted, and internal-logging-only)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
