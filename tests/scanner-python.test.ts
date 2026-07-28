import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/resend');

describe('scan() mixed JS + Python', () => {
  it('runs both engines and flags a dual-language rule in each language', async () => {
    const { results, languagesScanned, detected } = await scan(
      join(fixtures, 'mixed-js-py-broken'),
      { onlyProviders: ['resend'] },
    );

    expect(languagesScanned).toEqual(expect.arrayContaining(['javascript', 'python']));
    expect(detected.some((d) => d.name === 'resend')).toBe(true);

    // Asserted on missing-idempotency-key rather than api-key-hardcoded: the
    // latter is disabled in the manifest, and a disabled rule would make this
    // test vacuously pass on an empty result set. Any rule declaring
    // languages: ['javascript', 'python'] works here — it just has to be one
    // that is actually enabled.
    const hits = results.filter((r) => r.ruleKey === 'resend-missing-idempotency-key');
    expect(hits.some((r) => r.file.endsWith('.ts'))).toBe(true);
    expect(hits.some((r) => r.file.endsWith('.py'))).toBe(true);
  });
});
