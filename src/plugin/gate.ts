/**
 * Central provider gate: wraps every registered rule so its reports are only
 * emitted when the linted file actually shows evidence of the rule's provider
 * (SDK import/require, client construction, provider-named wrapper binding,
 * or a provider-distinctive URL/token literal).
 *
 * This is the file-level half of the cross-fire fix: a file that never
 * references Twilio can no longer produce Twilio findings, regardless of what
 * shapes the rule matches. It applies uniformly in CLI scans and standalone
 * dist/plugin.js use — no configuration is threaded in.
 *
 * Mechanism: rule reports are buffered via a proxied `context.report`; the
 * gate feeds a ClientTracker from its own merged visitors and decides at
 * `Program:exit` whether to flush. Rules that themselves report at
 * `Program:exit` still work — visitor merge order runs the rule's exit
 * handler (which buffers its reports) before the gate's flush decision.
 */
import type { ProviderAnchor } from '../types.js';
import { ALL_ANCHORS, anchorFor } from './anchors.js';
import type { ClientTracker } from './client-tracker.js';
import { createClientTracker, mergeVisitors } from './client-tracker.js';

/**
 * Context wrapper that buffers `report()` calls, exposes the gate's tracker
 * as `context.providerTracker` (for rules doing per-call ownership checks),
 * and forwards everything else via the prototype chain.
 *
 * NOT a Proxy: oxlint defines `report` as a non-configurable, non-writable
 * own property on a preventExtensions'd context, so a Proxy `get` trap that
 * substitutes it violates the Proxy invariants and throws. A fresh object
 * with the real context as its prototype can shadow `report` freely.
 */
function bufferingContext(context: any, buffer: any[], tracker: ClientTracker): any {
  const forwarded = Object.create(context);
  Object.defineProperty(forwarded, 'report', {
    value: (diagnostic: any, ...extraArgs: any[]) => {
      buffer.push([diagnostic, extraArgs]);
    },
    enumerable: true,
  });
  forwarded.providerTracker = tracker;
  return forwarded;
}

/** Wraps one rule so its reports only flush when the file shows provider evidence. */
export function withProviderGate(anchor: ProviderAnchor, rule: any): any {
  return {
    ...rule,
    create(context: any) {
      // All anchors, not just this rule's: per-call ownership checks
      // (tracker.belongsTo) need to know when a receiver is verifiably some
      // OTHER provider's client to discriminate calls in mixed files.
      const filename = String(
        (context as any)?.filename ?? (context as any)?.getFilename?.() ?? '',
      );
      const tracker = createClientTracker(ALL_ANCHORS, filename);
      const buffer: any[] = [];
      const inner = rule.create(bufferingContext(context, buffer, tracker)) ?? {};
      const gateExit = {
        'Program:exit': () => {
          tracker.finalize();
          if (!tracker.hasFileEvidence(anchor.provider)) return;
          for (const [diagnostic, extraArgs] of buffer) {
            // Per-call ownership for every rule, not just the ones that thread
            // the tracker. Uses `deniedFor`, which fires only on a POSITIVE
            // attribution elsewhere — "cannot tell" always passes, so rules
            // anchored on literals or on absence are untouched.
            const node = (diagnostic as any)?.node;
            if (node && tracker.deniedFor(node, anchor.provider)) continue;
            context.report(diagnostic, ...extraArgs);
          }
        },
      };
      return mergeVisitors(inner, tracker.visitors(), gateExit);
    },
  };
}

/** Longest-first provider prefixes so `openai-*` never matches a shorter name. */
const PROVIDER_PREFIXES = ALL_ANCHORS.map((a) => a.provider).sort((a, b) => b.length - a.length);

export function providerForRuleKey(ruleKey: string): string {
  for (const provider of PROVIDER_PREFIXES) {
    if (ruleKey.startsWith(`${provider}-`)) return provider;
  }
  throw new Error(`gate.ts: rule key "${ruleKey}" matches no provider prefix`);
}

/** Wraps every rule in a registration map with its provider's gate. */
export function gateAll(rules: Record<string, any>): Record<string, any> {
  const gated: Record<string, any> = {};
  for (const [key, rule] of Object.entries(rules)) {
    gated[key] = withProviderGate(anchorFor(providerForRuleKey(key)), rule);
  }
  return gated;
}
