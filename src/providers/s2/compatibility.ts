/**
 * Hand-verified symbol removals in @s2-dev/streamstore, consumed by the
 * s2-removed-symbol compatibility rule.
 *
 * The rule fires only on a mismatch between code and the INSTALLED version —
 * it never suggests upgrading. Every entry is verified by hand against the
 * published tarballs (implementation, not just the type diff): `wireIdentical`
 * means the old and new symbol issue the same HTTP method to the same URL
 * path with the same arguments, and must never be inferred from a rename
 * alone. Do not add entries from a symbol-name diff without that check.
 *
 * The `SymbolRemoval` shape and the rules for writing `verifyHint` live in
 * src/types.ts — this file is the S2 data and nothing else.
 */
import type { ProviderCompatibility, SymbolRemoval } from '../../types.js';

export const S2_PACKAGE = '@s2-dev/streamstore';

export const s2Removals: SymbolRemoval[] = [
  {
    symbol: 'createOrReconfigureBasin',
    removedIn: '0.24.0',
    replacement: 'ensureBasin',
    kind: 'rename',
    // Both versions: PUT /basins/{basin}, bearer auth, JSON body spread from
    // options — byte-identical request builders.
    wireIdentical: true,
    verifiedAt: '2026-08-06',
    evidence:
      'dist/esm/generated/sdk.gen.d.ts:51 in 0.23.0 vs 0.24.0 (npm pack); wire call compared in sdk.gen.js:138',
    verifyHint:
      'Same PUT /basins/{basin}, same auth, same request shape. No behavior change — this is a name-only rename.',
  },
  {
    symbol: 'createOrReconfigureStream',
    removedIn: '0.24.0',
    replacement: 'ensureStream',
    kind: 'rename',
    // Both versions: PUT /streams/{stream}, bearer auth, identical builder.
    wireIdentical: true,
    verifiedAt: '2026-08-06',
    evidence:
      'dist/esm/generated/sdk.gen.d.ts:87 in 0.23.0 vs :99 in 0.24.0 (npm pack); wire call compared in sdk.gen.js:285/334',
    verifyHint:
      'Same PUT /streams/{stream}, same auth, same request shape. No behavior change — this is a name-only rename.',
  },
];


/**
 * Manifest-facing record. Declaring this on `s2Manifest.compatibility` is the
 * only registration step — nothing else needs to learn that S2 has removals.
 */
export const s2Compatibility: ProviderCompatibility = {
  package: S2_PACKAGE,
  removals: s2Removals,
};
