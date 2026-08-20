/**
 * supabase-removed-method (compatibility)
 *
 * Data and prose only — the detection lives in the shared factory
 * (`providers/_shared/removed-method.ts`). What is Supabase-specific is the
 * package, the hand-verified removals in `compatibility.ts`, and the
 * rationale below.
 */
import { createRemovedMethodRule } from '../../../_shared/removed-method.js';
import { SUPABASE_PACKAGE, supabaseMethodRemovals } from '../../compatibility.js';

export const supabaseRemovedMethodRule = createRemovedMethodRule({
  packageName: SUPABASE_PACKAGE,
  provider: 'supabase',
  removals: supabaseMethodRemovals,
  description:
    'Auth or realtime method called here does not exist in the installed @supabase/supabase-js version',
  rationale:
    'v1 Supabase idioms are the single most common thing an agent gets wrong about this SDK: auth.signIn, auth.user() and auth.session() dominate the pre-2022 material the models learned from, and they are still emitted constantly into projects that have v2 installed, where they are a TypeError at runtime rather than a compile error. The client is still created by the same createClient import, so nothing at the top of the file records the mismatch. The check compares code against the version resolved from the project itself and only fires on a provable mismatch: a project deliberately pinned to v1 is correct and is never flagged, and the rule never suggests upgrading.',
  docsUrl: 'https://supabase.com/docs/reference/javascript/v1/upgrade-guide',
});
