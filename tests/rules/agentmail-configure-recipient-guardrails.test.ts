import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-configure-recipient-guardrails';

describe('agentmail-configure-recipient-guardrails rule', () => {
  it('flags both broken fixtures (while(true) responder, setInterval responder)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /Lists guardrails/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (allowlisted agent, adversarial one-shot script)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
