/**
 * s2-removed-symbol (compatibility)
 *
 * Data and prose only — the detection lives in the shared factory
 * (`providers/_shared/removed-symbol.ts`), which every provider's
 * compatibility rule is built from. What is S2-specific is the package, the
 * hand-verified removals in `compatibility.ts`, and the rationale below.
 */
import { createRemovedSymbolRule } from '../../../_shared/removed-symbol.js';
import { S2_PACKAGE, s2Removals } from '../../compatibility.js';

export const s2RemovedSymbolRule = createRemovedSymbolRule({
  packageName: S2_PACKAGE,
  removals: s2Removals,
  description:
    'SDK symbol used by this code does not exist in the installed @s2-dev/streamstore version',
  rationale:
    'AI agents trained before an SDK release write symbols that were real at training time and are gone in the version the project has installed — in plain .js files, nothing else catches the resulting runtime failure. The check compares code against the version resolved from the project itself (node_modules, lockfile, or a pinned range) and only fires on a provable mismatch: a deliberately pinned older SDK using the old names is correct and never flagged. createOrReconfigureBasin/createOrReconfigureStream became ensureBasin/ensureStream in 0.24.0 with byte-identical wire calls (verified against both published tarballs), so the fix is a rename, not a behavior change.',
  docsUrl: 'https://s2.dev/docs/sdk/stream-resources',
});
