import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-removed-symbol';

describe('s2-removed-symbol rule', () => {
  it('flags removed symbols when the installed version no longer has them (0.25.0)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      // The finding is a bug report against what is installed: it names the
      // removal version, the installed version, and the replacement.
      expect(diags.some((d: any) => /was removed in 0\.24\.0/.test(d.message))).toBe(true);
      expect(diags.some((d: any) => /you have 0\.25\.0 installed/.test(d.message))).toBe(true);
      expect(diags.some((d: any) => /ensure(Basin|Stream)/.test(d.message))).toBe(true);
      // The core design principle: the rule never tells anyone to upgrade.
      expect(diags.every((d: any) => !/upgrad|newer version/i.test(d.message))).toBe(true);
    }
  });

  it('stays silent when the pinned version still has the symbols (0.23.0)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
