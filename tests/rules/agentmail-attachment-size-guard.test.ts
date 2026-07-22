import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-attachment-size-guard';

describe('agentmail-attachment-size-guard rule', () => {
  it('flags both broken fixtures (disk read attached inline, download attached inline)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /6 MB/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (size check with url fallback, adversarial url-only attachment)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
