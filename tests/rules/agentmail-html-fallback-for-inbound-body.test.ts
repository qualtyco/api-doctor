import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-html-fallback-for-inbound-body';

describe('agentmail-html-fallback-for-inbound-body rule', () => {
  it('flags both broken fixtures (invoice classifier, thread-to-text map)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /HTML-only/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (html fallback, adversarial res.text() fetch)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
