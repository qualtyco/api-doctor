import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'supabase-validate-uuid-columns';

describe('supabase-validate-uuid-columns rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /UUID-shape regex/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (UUID_RE, and a differently-named UUID-shaped regex)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
