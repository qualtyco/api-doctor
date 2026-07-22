import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'elevenlabs-no-error-object-logging';

describe('elevenlabs-no-error-object-logging rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /rawErrorLogged|raw error/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (sanitized message, and message-only logging)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'elevenlabs')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
