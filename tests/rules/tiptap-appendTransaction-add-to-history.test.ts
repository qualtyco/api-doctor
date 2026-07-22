import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'tiptap-appendTransaction-add-to-history';

describe('tiptap-appendTransaction-add-to-history rule', () => {
  it('flags broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'tiptap')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not flag fixed fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'tiptap')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
