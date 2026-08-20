/**
 * agentmail-removed-method (compatibility)
 *
 * Data and prose only — the detection lives in the shared factory
 * (`providers/_shared/removed-method.ts`). What is AgentMail-specific is the
 * package, the hand-verified removals in `compatibility.ts`, and the
 * rationale below.
 */
import { createRemovedMethodRule } from '../../../_shared/removed-method.js';
import { AGENTMAIL_PACKAGE, agentmailMethodRemovals } from '../../compatibility.js';

export const agentmailRemovedMethodRule = createRemovedMethodRule({
  packageName: AGENTMAIL_PACKAGE,
  provider: 'agentmail',
  removals: agentmailMethodRemovals,
  description:
    'Client method called here does not exist in the installed agentmail version',
  rationale:
    'AgentMail is a fast-moving 0.x SDK where a minor bump is a breaking change by convention, and its metrics endpoint has been renamed twice — list, then query, then split into queryEvents and queryUsage in 0.5.12. An agent trained on any earlier point writes a method that is simply not on the client, which in a plain .js file surfaces as a TypeError at request time and nowhere earlier. The check compares code against the version resolved from the project itself and only fires on a provable mismatch: a project pinned to 0.5.11 calling metrics.query is correct and is never flagged, and the rule never suggests upgrading.',
  docsUrl: 'https://docs.agentmail.to/api-reference',
});
