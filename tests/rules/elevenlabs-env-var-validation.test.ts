import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'elevenlabs-env-var-validation';

describe('elevenlabs-env-var-validation rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /missingStartupValidation|module/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (module-scope validation, and a non-ElevenLabs key)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
