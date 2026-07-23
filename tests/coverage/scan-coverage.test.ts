import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../../src/scanner.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'resend');

describe('scan() coverage integration', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('resend');
    // emails.send from the renamed client, emails.get via dynamic access on a
    // wrapper import. The reference-only emails.cancel, the destructured
    // domains.list, and the test-file broadcasts.create must all be absent.
    expect(coverage?.[0].used).toEqual(['emails.get', 'emails.send']);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('resend');
    expect(detected.find((d) => d.name === 'resend')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
