import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-realtime-buffer-audio-until-session-ready';

describe('openai-realtime-buffer-audio-until-session-ready rule', () => {
  it('flags all broken fixtures (else-branch drop and !==-OPEN early-return drop)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /dropped here instead of being buffered/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (queued and flushed, adversarial different readyState check, early-return that buffers)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
