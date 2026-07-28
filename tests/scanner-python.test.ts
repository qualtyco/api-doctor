import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/resend');

// PYTHON-DORMANT: intended behavior changed for the TypeScript-only release —
// scan() no longer classifies, walks, or lints .py files, so this end-to-end
// expectation is deliberately suspended rather than deleted. Reverting the
// commit that disabled the Python engine un-skips it and it passes again.
//
// The per-rule Python tests (tests/rules/*-python-rules.test.ts) still run:
// they drive the runtime directly via lintPythonFixture and never touch scan(),
// so the Python rule pack stays under test while the product ships without it.
describe.skip('scan() mixed JS + Python', () => {
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
