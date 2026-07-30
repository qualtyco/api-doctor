import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-no-domain-allowlist';

describe('openai-no-domain-allowlist rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /origin/i.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (hostname allowlist, origin comparison, plain Playwright test, chat-completions-only file)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
