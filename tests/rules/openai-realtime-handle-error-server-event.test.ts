import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-realtime-handle-error-server-event';

describe('openai-realtime-handle-error-server-event rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /never checks for/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (error branch present, and adversarial no-dispatch handler)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
