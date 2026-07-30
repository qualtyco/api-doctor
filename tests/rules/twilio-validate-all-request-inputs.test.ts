import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'twilio-validate-all-request-inputs';

describe('twilio-validate-all-request-inputs rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /missingQuerystringSchema|missingSchemaEntirely|schema/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (querystring schema added, input-free health check, and a generic non-Twilio JSON route)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
