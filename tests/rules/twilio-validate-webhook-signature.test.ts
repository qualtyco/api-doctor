import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'twilio-validate-webhook-signature';

describe('twilio-validate-webhook-signature rule', () => {
  it('flags every broken fixture (TwiML routes and a status-callback reading Twilio body fields)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /missingSignatureValidation|X-Twilio-Signature/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (validated routes, and non-Twilio POST routes: Stripe webhook, login)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
