import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-realtime-reconnect-on-drop';

describe('openai-realtime-reconnect-on-drop rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /never attempts to reconnect/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (reconnect call present, and adversarial non-OpenAI socket)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
