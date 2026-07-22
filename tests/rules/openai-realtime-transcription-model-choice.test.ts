import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'openai-realtime-transcription-model-choice';

describe('openai-realtime-transcription-model-choice rule', () => {
  it('flags all broken fixtures (flat beta shape and GA audio.input.transcription shape)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /not natively streaming/.test(d.message))).toBe(true);
    }
  });

  it('does not flag any fixed fixture (streaming model in both shapes, and adversarial non-session.update object)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'openai-realtime')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
