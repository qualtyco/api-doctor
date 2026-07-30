import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-retry-transient-turn-errors';

describe('openai-retry-transient-turn-errors rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /no turn-level retry/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (retry loop, and catch calls retry helper)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
