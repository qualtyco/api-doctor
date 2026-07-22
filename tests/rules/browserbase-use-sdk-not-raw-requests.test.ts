import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'browserbase-use-sdk-not-raw-requests';

describe('browserbase-use-sdk-not-raw-requests rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /raw HTTP request/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (SDK recording.retrieve, and fetch to unrelated host)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
