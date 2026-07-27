import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/resend');

describe('scan() mixed JS + Python', () => {
  it('runs both engines and flags hardcoded keys in each language', async () => {
    const { results, languagesScanned, detected } = await scan(
      join(fixtures, 'mixed-js-py-broken'),
      { onlyProviders: ['resend'] },
    );

    expect(languagesScanned).toEqual(expect.arrayContaining(['javascript', 'python']));
    expect(detected.some((d) => d.name === 'resend')).toBe(true);

    const keys = results.filter((r) => r.ruleKey === 'resend-api-key-hardcoded');
    expect(keys.some((r) => r.file.endsWith('.ts'))).toBe(true);
    expect(keys.some((r) => r.file.endsWith('.py'))).toBe(true);
  });
});
