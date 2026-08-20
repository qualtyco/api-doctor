/**
 * The removed-METHOD-PATH compatibility rule, once, for every provider.
 *
 * Sibling of `removed-symbol.ts`, and the reason both exist: an SDK breaks a
 * caller in two structurally different ways, and only one of them is visible
 * at an import statement.
 *
 *   import { createOrReconfigureBasin } from '@s2-dev/streamstore'  ← symbol
 *   supabase.auth.signIn({ email, password })                       ← method
 *
 * In the second case the import is still valid, the package name never
 * changed, and the only evidence is a property that is no longer on the
 * object. That is how nearly every HTTP SDK breaks — Fern, Stainless and
 * hand-written resource clients all expose their API as `client.a.b()` — so a
 * provider modelling only the first kind would stay silent through its own
 * major version bump. Supabase's v2, Browserbase's 2.0 and AgentMail's 0.5.12
 * are all invisible to `removed-symbol.ts` and all caught here.
 *
 * Detection is deliberately narrow, in the same spirit as its sibling:
 *
 *   - the call's trailing segments must equal the removal's dotted path, so
 *     `metrics.query` matches `client.metrics.query()` but not a bare
 *     `query()` and not `client.metrics.query.build()`;
 *   - the RECEIVER must trace to this provider's SDK, via the gate's
 *     ClientTracker. A project's own `auth.signIn()` helper, or another
 *     provider's client in the same file, never matches;
 *   - the installed version must be resolvable AND at or past `removedIn`.
 *     Unresolvable stays silent — it must never be read as "latest".
 *
 * It never suggests upgrading. Code calling a v1 method on a project that has
 * v1 installed is correct and stays silent forever; the finding only exists
 * when the call provably cannot reach the code that is in node_modules.
 *
 * Forking this per provider would mean maintaining the same receiver-identity
 * reasoning in N places and letting those precision guarantees drift apart —
 * the same argument that keeps `removed-symbol.ts` shared.
 */
import { compareSemver, resolveInstalledVersion } from '../../plugin/installed-version.js';
import { calleeChain } from '../../plugin/client-tracker.js';
import { migrationTargetFor } from '../../plugin/migration-target.js';
import type { MethodRemoval } from '../../types.js';

export interface RemovedMethodRuleOptions {
  /** npm package whose installed version decides whether a call is broken. */
  packageName: string;
  /** Provider name, as used by the gate's anchors — receiver attribution. */
  provider: string;
  /** Hand-verified method removals for that package. */
  removals: MethodRemoval[];
  /** One-line rule description for the registry. */
  description: string;
  /** Why this rule exists, in the developer's terms. Provider-specific prose. */
  rationale: string;
  /** Provider docs page for the affected methods. */
  docsUrl: string;
}

/**
 * Builds one provider's removed-method rule.
 *
 * The message templates are shared across providers on purpose. Only a
 * wire-identical rename may be stated as a rename and nothing more; a split
 * lists its successors without choosing between them (only the arguments
 * decide, and the rule does not read arguments); everything else gets the bare
 * removal message, so a behaviour change is never described in words that
 * imply a drop-in replacement.
 */
/**
 * Which forward-looking message a removal gets in migration mode.
 *
 * It differs from the backward set in exactly one place, on purpose: a
 * `signature-change` carrying a replacement gets `migrateChangedMethod`, which
 * NAMES the successor. The backward path deliberately collapses that case to
 * the bare removal message, because a developer whose code is already broken
 * needs to know it is broken and must not be handed a name that reads like a
 * drop-in. Someone planning an upgrade has the opposite need — they cannot plan
 * toward a destination the report refuses to name — so the message states where
 * it goes and points at the Verify line for what changes on the way.
 */
function migrationMessageId(removal: MethodRemoval): string {
  if (removal.kind === 'rename' && removal.wireIdentical && removal.replacement) {
    return 'migrateRenamedMethod';
  }
  if (removal.kind === 'moved' && removal.replacement) return 'migrateMovedMethod';
  if (removal.kind === 'split' && removal.replacements?.length) return 'migrateSplitMethod';
  if (removal.replacement) return 'migrateChangedMethod';
  return 'migrateRemovedMethod';
}

export function createRemovedMethodRule(options: RemovedMethodRuleOptions) {
  const { packageName, provider, removals, description, rationale, docsUrl } = options;

  /** Segment arrays to match call chains against, one per removal. */
  const matchers = removals.map((r) => ({ removal: r, segments: r.path.split('.') }));
  /** Longest paths first: `auth.signIn` must win over a hypothetical `signIn`. */
  matchers.sort((a, b) => b.segments.length - a.segments.length);

  return {
    meta: {
      type: 'problem',
      docs: {
        description,
        category: 'compatibility',
        rationale,
        docsUrl,
        recommended: true,
      },
      messages: {
        renamedMethod:
          '{{path}} was removed in {{removedIn}} — you have {{installed}} installed. Renamed to {{replacement}}. Same request, same arguments.',
        movedMethod:
          '{{path}} was removed in {{removedIn}} — you have {{installed}} installed. It is now {{replacement}}.',
        splitMethod:
          '{{path}} was removed in {{removedIn}} — you have {{installed}} installed. It was split into {{replacements}}; which one applies depends on the arguments.',
        removedMethod:
          '{{path}} was removed in {{removedIn}} — you have {{installed}} installed.',
        // Migration mode. Same facts, opposite tense: nothing here is broken
        // yet, so none of these may read as a defect. They are only ever
        // rendered when the user named a target on the command line.
        migrateRenamedMethod:
          '{{path}} becomes {{replacement}} in {{removedIn}} — a rename, same request and same arguments.',
        migrateMovedMethod: '{{path}} becomes {{replacement}} in {{removedIn}}.',
        migrateChangedMethod:
          '{{path}} becomes {{replacement}} in {{removedIn}}, with a different contract — read the Verify line before rewriting this call.',
        migrateSplitMethod:
          '{{path}} is split into {{replacements}} in {{removedIn}}; which one applies depends on the arguments at this call site.',
        migrateRemovedMethod: '{{path}} is removed in {{removedIn}} with no successor.',
      },
      schema: [],
    },
    create(context: any) {
      const tracker = (context as any).providerTracker;

      /** Matched call sites, held until Program:exit so aliases are resolved. */
      const hits: Array<{ removal: MethodRemoval; node: any }> = [];

      return {
        CallExpression(node: any) {
          const chain = calleeChain(node.callee);
          if (!chain) return;
          const { segments } = chain;
          if (segments.length === 0) return;

          for (const { removal, segments: want } of matchers) {
            if (want.length > segments.length) continue;
            // Trailing-segment match: the path as the developer writes it,
            // whatever the receiver is called. `client.metrics.query()`,
            // `this.mail.metrics.query()` and `bb.sessions.list()` all reduce
            // to the same tail.
            const tail = segments.slice(segments.length - want.length);
            if (tail.every((s, i) => s === want[i])) {
              hits.push({ removal, node });
              return; // longest match wins; never report one call twice
            }
          }
        },

        'Program:exit'() {
          if (hits.length === 0) return;

          const filename = String(
            context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? '',
          );
          if (!filename) return;
          const installed = resolveInstalledVersion(filename, packageName);
          if (!installed) return; // cannot resolve → stay silent, never assume latest

          // Undefined on every ordinary run, and on any run migrating a
          // different provider. Its presence is the only thing that reverses
          // the comparison below — nothing infers a migration from the
          // versions alone.
          const migrate = migrationTargetFor(provider);

          for (const { removal, node } of hits) {
            const cmp = compareSemver(installed, removal.removedIn);
            if (cmp === null) continue; // unparseable stays silent in both directions

            if (migrate) {
              // Forward: the project is BELOW removedIn (so this call works
              // today) and the requested target is at or past it (so the call
              // would stop working). Both halves are required — without the
              // second, asking to go from 1.20 to 1.30 would list breaks that
              // only land in 2.0.
              if (cmp >= 0) continue; // already past this removal — nothing to plan
              const reach = compareSemver(migrate.target, removal.removedIn);
              if (reach === null || reach < 0) continue; // target never crosses it
            } else {
              // Backward: fire only when installed >= removedIn.
              if (cmp < 0) continue;
            }

            // Receiver identity, checked last because it is the expensive
            // question and the version gate rejects most files before it.
            //
            // `resolveOwner`, deliberately NOT `belongsTo`: belongsTo falls
            // back to file-level evidence when a receiver is unattributable,
            // which is right for a rule that flags a risky pattern and wrong
            // here. This finding claims a specific call throws at runtime, so
            // it needs the receiver actually traced to the SDK — otherwise an
            // `emitter.removeSubscription()` in any file that also imports
            // Supabase would be reported as a Supabase break.
            //
            // The tracker is supplied by the gate; without it (a rule used
            // outside the plugin) there is no way to establish the receiver,
            // and an unverifiable receiver must not produce a finding.
            if (!tracker) continue;
            const owner = tracker.resolveOwner(node);
            if (owner.tier === 'unknown' || owner.provider !== provider) continue;

            const messageId = migrate
              ? migrationMessageId(removal)
              : removal.kind === 'rename' && removal.wireIdentical && removal.replacement
                ? 'renamedMethod'
                : removal.kind === 'moved' && removal.replacement
                  ? 'movedMethod'
                  : removal.kind === 'split' && removal.replacements?.length
                    ? 'splitMethod'
                    : 'removedMethod';

            context.report({
              node,
              messageId,
              data: {
                path: removal.path,
                removedIn: removal.removedIn,
                installed,
                replacement: removal.replacement ?? '',
                replacements: (removal.replacements ?? []).join(', '),
              },
            });
          }
        },
      };
    },
  };
}
