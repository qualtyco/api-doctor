/**
 * browserbase-removed-method (compatibility)
 *
 * Data and prose only — the detection lives in the shared factory
 * (`providers/_shared/removed-method.ts`). What is Browserbase-specific is the
 * package, the hand-verified removals in `compatibility.ts`, and the
 * rationale below.
 */
import { createRemovedMethodRule } from '../../../_shared/removed-method.js';
import { BROWSERBASE_PACKAGE, browserbaseMethodRemovals } from '../../compatibility.js';

export const browserbaseRemovedMethodRule = createRemovedMethodRule({
  packageName: BROWSERBASE_PACKAGE,
  provider: 'browserbase',
  removals: browserbaseMethodRemovals,
  description:
    'Client method called here does not exist in the installed @browserbasehq/sdk version',
  rationale:
    'Browserbase 2.0 replaced a flat hand-written client with a generated resource client: bb.createSession() became bb.sessions.create(), and every other 1.x method moved the same way. The package name and the Browserbase constructor did not change, so a file mixing v1 calls with a v2 install looks entirely normal until the call throws. The check compares code against the version resolved from the project itself and only fires on a provable mismatch: a project pinned to 1.x is correct and is never flagged, and the rule never suggests upgrading.',
  docsUrl: 'https://docs.browserbase.com/reference/sdk/nodejs',
});
