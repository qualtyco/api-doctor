import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner.js';

// The fixture holds an identical broken Resend webhook handler four times:
// once at the root (webhook.ts) and once inside each conventional test
// directory (test/, tests/, __tests__/). Only the root copy may be walked or
// flagged — test code is skipped by both the scanner walk and the oxlint
// engine.
const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'scanner',
  'skip-test-dirs',
);

describe('scan skips test directories', () => {
  it('walks only the non-test file and still detects the provider from it', async () => {
    const { filesScanned, detected, results } = await scan(fixtureDir);

    expect(filesScanned).toBe(1);
    expect(detected.map((d) => d.name)).toContain('resend');

    const files = results.map((r) => r.file);
    expect(files).toContain('webhook.ts');
    for (const file of files) {
      expect(file).not.toMatch(/(^|\/)(test|tests|__tests__)\//);
    }
  });

  it('reports each finding once — the copies under test dirs never reach the engine', async () => {
    const { results } = await scan(fixtureDir);
    const hits = results.filter((r) => r.rule === 'resend/webhook-signature-missing');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.file).toBe('webhook.ts');
  });
});
