import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'twilio-media-streams-mark-name-string';

describe('twilio-media-streams-mark-name-string rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /markNameNotString|mark\.name/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (String()-wrapped, and a string-valued identifier)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
