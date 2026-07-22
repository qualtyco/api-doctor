import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-cua-set-safety-identifier';

describe('openai-cua-set-safety-identifier rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /safety_identifier/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (hashed safety_identifier, and legacy user param)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
