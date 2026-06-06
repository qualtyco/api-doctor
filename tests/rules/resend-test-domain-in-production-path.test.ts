import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-test-domain-in-production-path';

describe('resend-test-domain-in-production-path rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /test-only sender/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (verified domain, and a skipped test file)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
