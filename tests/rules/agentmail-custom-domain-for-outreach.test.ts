import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-custom-domain-for-outreach';

describe('agentmail-custom-domain-for-outreach rule', () => {
  it('flags both broken fixtures (gtm campaign, no-args create campaign)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /shared @agentmail.to|subdomain/.test(d.message))).toBe(true);
    }
  });

  it('does not flag fixed fixtures (custom subdomain, adversarial transactional-only)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
