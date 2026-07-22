import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-single-read-is-capped';

describe('s2-single-read-is-capped rule', () => {
  it('flags both broken fixtures (bare full-history read, capped export read)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /readSession/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (read session, coordinate read-back)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
