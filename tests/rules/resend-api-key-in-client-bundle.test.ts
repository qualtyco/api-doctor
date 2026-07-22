import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-api-key-in-client-bundle';
const base = join(dirname(dirname(fileURLToPath(import.meta.url))), 'fixtures', 'resend');

const broken = [
  join(base, `${ruleKey}-broken`, '01-use-client-directive.tsx'),
  join(base, `${ruleKey}-broken`, 'components', 'Newsletter.tsx'),
];
const fixed = [
  join(base, `${ruleKey}-fixed`, '01-server-route.ts'),
  join(base, `${ruleKey}-fixed`, 'components', 'EmailPreview.tsx'),
];

describe('resend-api-key-in-client-bundle rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of broken) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /client-bundled code/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture', () => {
    for (const file of fixed) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
