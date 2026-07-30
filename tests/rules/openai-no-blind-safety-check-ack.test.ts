import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-no-blind-safety-check-ack';

describe('openai-no-blind-safety-check-ack rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /never inspects/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (code allowlist, and message denylist)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
