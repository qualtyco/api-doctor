import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-structured-step-metadata-not-text-json';

describe('openai-structured-step-metadata-not-text-json rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /brace-hunting/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (structured tool arguments, validation-only indexOf, and non-CUA log parsing)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
