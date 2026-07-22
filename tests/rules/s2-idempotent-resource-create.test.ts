import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-idempotent-resource-create';

describe('s2-idempotent-resource-create rule', () => {
  it('flags both broken fixtures (bare streams.create, bare basins.create)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /409/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (.catch chain, enclosing try/catch)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
