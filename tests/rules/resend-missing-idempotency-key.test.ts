import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-missing-idempotency-key';

describe('resend-missing-idempotency-key rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /idempotencyKey/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (key in payload, in options arg, or no key derivable)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });

  // A function that forwards a caller-supplied subject *and* body cannot name
  // the operation it is performing, so it has nothing to seed a key with.
  it('stays quiet inside a generic transport wrapper', () => {
    const [file] = fixtureFiles(ruleKey, 'fixed').filter((f) => f.includes('generic-transport'));
    expect(lintFileForRule(ruleKey, file)).toHaveLength(0);
  });

  // The suppression must not swallow a wrapper that fixes either half of the
  // message identity — those know which operation they are.
  it('still flags a wrapper that names its own operation', () => {
    const [file] = fixtureFiles(ruleKey, 'broken').filter((f) => f.includes('named-operation'));
    expect(lintFileForRule(ruleKey, file)).toHaveLength(2);
  });
});
