import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-no-message-id-as-thread-id';

describe('agentmail-no-message-id-as-thread-id rule', () => {
  it('flags both broken fixtures (?? coalesce, || fallback)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /thread/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (fail loudly, adversarial separate ids)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
