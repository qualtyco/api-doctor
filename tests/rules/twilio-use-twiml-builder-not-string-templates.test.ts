import { describe, expect, it } from 'vitest';
import { fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'twilio-use-twiml-builder-not-string-templates';

describe('twilio-use-twiml-builder-not-string-templates rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /rawTwimlTemplate|VoiceResponse/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture (VoiceResponse builder, and static TwiML template)', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'twilio')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
