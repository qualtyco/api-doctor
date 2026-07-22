import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'twilio-media-streams-mark-pacing';

describe('twilio-media-streams-mark-pacing rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /noMarkPacing|31931/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (isLast passed, and conservative no-flag with unrelated isLast)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
