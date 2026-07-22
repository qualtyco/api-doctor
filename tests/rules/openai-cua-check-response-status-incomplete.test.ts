import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-cua-check-response-status-incomplete';

describe('openai-cua-check-response-status-incomplete rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /response\.status/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (status check adjacent, and early guard far from success branch)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
