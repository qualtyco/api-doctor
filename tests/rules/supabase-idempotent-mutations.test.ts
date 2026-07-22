import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'supabase-idempotent-mutations';

describe('supabase-idempotent-mutations rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /unique\/idempotency key/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (idempotency_key field, and upsert+onConflict)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
