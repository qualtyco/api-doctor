import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-cua-structured-step-metadata-not-text-json';

describe('openai-cua-structured-step-metadata-not-text-json rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /brace-hunting/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (structured tool arguments, and indexOf used only for validation)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-cua')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
