import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'elevenlabs-conversation-cleanup-on-error';

describe('elevenlabs-conversation-cleanup-on-error rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /missingTryCatch|try\/catch/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (direct try/catch, and call inside an unrelated try block)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
