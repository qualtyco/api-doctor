import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-unchecked-send-error';

describe('resend-unchecked-send-error rule', () => {
  it('flags every broken fixture', () => {
    for (const file of fixtureFiles(ruleKey, 'broken')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /never checks error/.test(d.message))).toBe(true);
    }
  });

  it('flags a send whose failure a surrounding try/catch cannot reach', () => {
    const [file] = fixtureFiles(ruleKey, 'broken').filter((f) => f.includes('try-catch'));
    expect(lintFileForRule(ruleKey, file)).toHaveLength(1);
  });

  it('flags both mutations in the non-send fixture', () => {
    const [file] = fixtureFiles(ruleKey, 'broken').filter((f) => f.includes('non-send'));
    expect(lintFileForRule(ruleKey, file)).toHaveLength(2);
  });

  it('does not flag any fixed fixture', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
