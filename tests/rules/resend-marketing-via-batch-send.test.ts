import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'resend-marketing-via-batch-send';
const base = join(dirname(dirname(fileURLToPath(import.meta.url))), 'fixtures', 'resend');

// Neutral parent folders: the rule keys off marketing keywords in the path, and
// the rule's own name contains "marketing" — so fixtures live under `batch-send-*`.
const broken = [
  join(base, 'batch-send-broken', 'campaign', 'route.ts'),
  join(base, 'batch-send-broken', 'newsletter-blast.ts'),
];
const fixed = [
  join(base, 'batch-send-fixed', 'order-receipts.ts'),
  join(base, 'batch-send-fixed', 'campaign-via-broadcasts.ts'),
];

describe('resend-marketing-via-batch-send rule', () => {
  it('flags both broken fixtures', () => {
    for (const file of broken) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /Broadcasts API/.test(d.message))).toBe(true);
    }
  });

  it('does not flag either fixed fixture', () => {
    for (const file of fixed) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
