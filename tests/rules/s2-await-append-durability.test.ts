import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 's2-await-append-durability';

describe('s2-await-append-durability rule', () => {
  it('flags both broken fixtures (unclosed session, discarded producer tickets)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /ack\(\)/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (ack + close, close-only flush)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 's2')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
