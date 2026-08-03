/**
 * Single-file client-identity tracking for lint rules.
 *
 * Reimplements the plugin-safe half of the coverage collector's verified
 * client tracing (src/coverage/collect.ts) — imports, constructions, alias
 * resolution, `this.<prop>` bindings — without oxc-parser and without
 * cross-module resolution, so it can run inside oxlint rule visitors.
 * The plugin must never import src/coverage/ (dist/plugin.js stays lint-only);
 * this module is the shared replacement.
 *
 * Ownership is tiered, never hard-dropped (linting is not telemetry — a
 * wrapper import like `import { client } from './lib/twilio'` must still
 * count for its provider):
 *   verified — traced to a construction / SDK ctor import / alias / this-prop
 *   named    — the binding or its wrapper-import source names the provider
 *   unknown  — everything else; falls back to file-level evidence
 */
import type { ProviderAnchor } from '../types.js';
import { clientBindingsFor, nonClientBindingsFor } from './client-modules.js';

/** True when an import/require source belongs to one of the anchor's SDK packages. */
export function packageMatches(anchor: ProviderAnchor, source: string): boolean {
  for (const pkg of anchor.packages) {
    if (pkg.endsWith('/')) {
      if (source.startsWith(pkg)) return true;
    } else if (source === pkg || source.startsWith(`${pkg}/`)) {
      return true;
    }
  }
  return false;
}

/** Unwraps TS/chain wrappers: `expr!`, `expr as T`, `expr satisfies T`, `expr?.`, parens. */
export function unwrapExpr(node: any): any {
  let n = node;
  while (
    n &&
    (n.type === 'TSNonNullExpression' ||
      n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'ChainExpression' ||
      n.type === 'ParenthesizedExpression')
  ) {
    n = n.expression;
  }
  return n;
}

/** Name of a MemberExpression property: `x.send` or `x["send"]` → "send". */
export function memberPropName(member: any): string | null {
  if (member?.type !== 'MemberExpression') return null;
  const prop = member.property;
  if (!member.computed && prop?.type === 'Identifier') return prop.name;
  if (member.computed && prop?.type === 'Literal' && typeof prop.value === 'string') {
    return prop.value;
  }
  return null;
}

/** Splits a callee into its root expression and dotted member segments. */
export function calleeChain(callee: any): { root: any; segments: string[] } | null {
  const segments: string[] = [];
  let n = unwrapExpr(callee);
  while (n?.type === 'MemberExpression') {
    const name = memberPropName(n);
    if (name === null) return null;
    segments.unshift(name);
    n = unwrapExpr(n.object);
  }
  return { root: n, segments };
}

/** If `init` is `require('<source>')`, returns the source string. */
function requireSource(init: any): string | null {
  if (init?.type !== 'CallExpression') return null;
  if (init.callee?.type !== 'Identifier' || init.callee.name !== 'require') return null;
  const arg = init.arguments?.[0];
  return arg?.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null;
}

export type Ownership =
  | { tier: 'verified'; provider: string }
  | { tier: 'named'; provider: string }
  | { tier: 'unknown' };

export interface ClientTracker {
  /** Visitors to merge into the rule's own — feed the whole file through these. */
  visitors(): Record<string, (node: any) => void>;
  /** Resolves outstanding aliases; call at Program:exit before final queries. */
  finalize(): void;
  /** Direct SDK evidence: import, require, construction, or provider-named binding. */
  hasDirectEvidence(provider: string): boolean;
  /** Full evidence union: direct evidence, or a provider URL/token in any literal. */
  hasFileEvidence(provider: string): boolean;
  /** Ownership of a call's receiver (pass the CallExpression, callee, or root expr). */
  resolveOwner(node: any): Ownership;
  /**
   * True only when the receiver is POSITIVELY attributed to something other
   * than `provider` — another tracked provider's client, or a binding the CLI
   * traced to a non-provider origin.
   *
   * Distinct from `!belongsTo()`: that also covers "cannot tell", which must
   * never suppress. This is the safe test for a blanket post-filter.
   */
  deniedFor(node: any, provider: string): boolean;
  /**
   * True when the call/receiver belongs to `provider`:
   * verified as it; or named as it (and not verified as another); or
   * unattributable while the file has direct evidence for it and the
   * receiver is not verified/named as a different provider.
   */
  belongsTo(node: any, provider: string): boolean;
}

interface ProviderState {
  anchor: ProviderAnchor;
  /** Local names bound to a client constructor/factory export. */
  ctorLocals: Set<string>;
  /** Local names bound to the SDK module namespace. */
  nsLocals: Set<string>;
  /** Local names holding a verified client instance. */
  clientVars: Set<string>;
  /** `this.<prop>` properties holding a verified client instance. */
  thisClientProps: Set<string>;
  /** Wrapper-import bindings that name the provider (named tier). */
  namedVars: Set<string>;
  /** Bindings the CLI traced to a non-provider origin — a definite no. */
  nonClientVars: Set<string>;
  direct: boolean;
  literal: boolean;
}

export function createClientTracker(
  anchors: ProviderAnchor[],
  filename?: string,
): ClientTracker {
  const states: ProviderState[] = anchors.map((anchor) => ({
    anchor,
    ctorLocals: new Set(),
    nsLocals: new Set(),
    clientVars: new Set(),
    thisClientProps: new Set(),
    namedVars: new Set(),
    nonClientVars: new Set(),
    direct: false,
    literal: false,
  }));
  /** `const alias = other` pairs, propagated incrementally and at finalize(). */
  const aliases: Array<[string, string]> = [];

  function isClientConstruction(node: any, s: ProviderState): boolean {
    const n = unwrapExpr(node);
    if (n?.type !== 'NewExpression' && n?.type !== 'CallExpression') return false;
    const callee = unwrapExpr(n.callee);
    if (callee?.type === 'Identifier') return s.ctorLocals.has(callee.name);
    if (callee?.type === 'MemberExpression') {
      const obj = unwrapExpr(callee.object);
      const prop = memberPropName(callee);
      return (
        obj?.type === 'Identifier' &&
        s.nsLocals.has(obj.name) &&
        prop !== null &&
        s.anchor.clientConstructors.includes(prop)
      );
    }
    return false;
  }

  function markSdkImportLocal(s: ProviderState, specType: string, imported: string | null, local: string): void {
    s.direct = true;
    if (specType === 'ImportSpecifier') {
      if (imported !== null && s.anchor.clientConstructors.includes(imported)) {
        s.ctorLocals.add(local);
      }
    } else if (specType === 'ImportNamespaceSpecifier') {
      s.nsLocals.add(local);
    } else if (specType === 'ImportDefaultSpecifier') {
      if (s.anchor.defaultIsFactory || s.anchor.clientConstructors.includes(local)) {
        s.ctorLocals.add(local);
      } else {
        s.nsLocals.add(local);
      }
    }
  }

  function markWrapperImport(s: ProviderState, source: string, local: string): void {
    const namedLocal = s.anchor.clientNamePattern?.test(local) ?? false;
    const wrapperSource = s.anchor.wrapperSourcePattern?.test(source) ?? false;
    if (namedLocal || wrapperSource) {
      s.direct = true;
      if (namedLocal) s.namedVars.add(local);
      // A wrapper source alone (`import { mailer } from '@/lib/resend'`)
      // names the file's evidence but not the binding — unless the local
      // also matches, the binding stays name-neutral.
    }
  }

  function visitImport(node: any): void {
    const source = node?.source?.value;
    if (typeof source !== 'string') return;
    for (const s of states) {
      const fromSdk = packageMatches(s.anchor, source);
      if (fromSdk) s.direct = true;
      for (const spec of node.specifiers ?? []) {
        const local = spec?.local?.type === 'Identifier' ? spec.local.name : null;
        if (!local) continue;
        if (fromSdk) {
          const imported =
            spec.type === 'ImportSpecifier'
              ? (spec.imported?.name ?? spec.imported?.value ?? null)
              : null;
          markSdkImportLocal(s, spec.type, imported, local);
        } else {
          markWrapperImport(s, source, local);
        }
      }
    }
  }

  function bindInit(name: string, init: any): void {
    if (!init) return;
    for (const s of states) {
      if (isClientConstruction(init, s)) {
        s.direct = true;
        s.clientVars.add(name);
      }
    }
    if (init.type === 'Identifier') {
      aliases.push([name, init.name]);
      // Incremental propagation so use-after-decl (the common order) resolves
      // without waiting for finalize().
      for (const s of states) {
        if (s.clientVars.has(init.name)) s.clientVars.add(name);
        if (s.namedVars.has(init.name)) s.namedVars.add(name);
      }
    }
  }

  function visitVariableDeclarator(node: any): void {
    // A binding whose *name* is the provider's, however it was produced.
    //
    // Frameworks hand the client over through context objects that no static
    // pass can follow — SvelteKit's `const { supabase } = locals`, set in
    // hooks.server.ts; Nuxt's `useSupabaseClient()`. The name is distinctive
    // enough to trust at the `named` tier, which is the same trust Reuben's
    // anchors already place in `import { supabase } from './lib/x'`.
    for (const s of states) {
      const pat = s.anchor.clientNamePattern;
      if (!pat) continue;
      if (node?.id?.type === 'Identifier' && pat.test(node.id.name)) {
        s.namedVars.add(node.id.name);
        s.direct = true;
      } else if (node?.id?.type === 'ObjectPattern') {
        for (const p of node.id.properties ?? []) {
          if (p?.type !== 'Property') continue;
          const local = p.value?.type === 'Identifier' ? p.value.name : null;
          if (local && pat.test(local)) {
            s.namedVars.add(local);
            s.direct = true;
          }
        }
      }
    }

    const init = unwrapExpr(node?.init);
    if (!init) return;
    const source = requireSource(init);
    if (source !== null) {
      for (const s of states) {
        if (!packageMatches(s.anchor, source)) {
          if (
            node.id?.type === 'Identifier' &&
            (s.anchor.wrapperSourcePattern?.test(source) || s.anchor.clientNamePattern?.test(node.id.name))
          ) {
            markWrapperImport(s, source, node.id.name);
          }
          continue;
        }
        s.direct = true;
        if (node.id?.type === 'Identifier') {
          if (s.anchor.defaultIsFactory) s.ctorLocals.add(node.id.name);
          else s.nsLocals.add(node.id.name);
        } else if (node.id?.type === 'ObjectPattern') {
          for (const p of node.id.properties ?? []) {
            if (
              p?.type === 'Property' &&
              p.key?.type === 'Identifier' &&
              s.anchor.clientConstructors.includes(p.key.name) &&
              p.value?.type === 'Identifier'
            ) {
              s.ctorLocals.add(p.value.name);
            }
          }
        }
      }
      return;
    }
    if (node.id?.type === 'Identifier') bindInit(node.id.name, init);
  }

  function visitAssignment(node: any): void {
    if (node?.operator !== '=') return;
    const left = unwrapExpr(node.left);
    const right = unwrapExpr(node.right);
    if (left?.type === 'Identifier') {
      bindInit(left.name, right);
    } else if (left?.type === 'MemberExpression' && unwrapExpr(left.object)?.type === 'ThisExpression') {
      const prop = memberPropName(left);
      if (prop === null) return;
      for (const s of states) {
        if (isClientConstruction(right, s)) {
          s.direct = true;
          s.thisClientProps.add(prop);
        }
      }
    }
  }

  function visitPropertyDefinition(node: any): void {
    if (node?.key?.type !== 'Identifier') return;
    scanIdentifierName(node.key.name);
    if (!node.value) return;
    const init = unwrapExpr(node.value);
    for (const s of states) {
      if (isClientConstruction(init, s)) {
        s.direct = true;
        s.thisClientProps.add(node.key.name);
      }
    }
  }

  function visitConstructionEvidence(node: any): void {
    for (const s of states) {
      if (!s.direct && isClientConstruction(node, s)) s.direct = true;
    }
  }

  function scanText(text: string): void {
    for (const s of states) {
      if (s.literal) continue;
      if (s.anchor.urlSubstrings.some((u) => text.includes(u)) || s.anchor.tokenPattern?.test(text)) {
        s.literal = true;
      }
    }
  }

  /**
   * Identifier-position evidence (property keys, member accesses, class
   * fields) for anchors that opt in via `identifierPattern`. Protocol-level
   * integrations — a Twilio Media Streams handler speaking the wire format
   * over a raw WebSocket — often carry no import and no distinctive string,
   * but do read and write the provider's field names.
   */
  function scanIdentifierName(name: unknown): void {
    if (typeof name !== 'string' || !name) return;
    for (const s of states) {
      if (s.literal || !s.anchor.identifierPattern) continue;
      if (s.anchor.identifierPattern.test(name)) s.literal = true;
    }
  }

  function visitPropertyKey(node: any): void {
    if (node?.key?.type === 'Identifier') scanIdentifierName(node.key.name);
  }

  function visitMemberProp(node: any): void {
    if (!node?.computed && node?.property?.type === 'Identifier') {
      scanIdentifierName(node.property.name);
    }
  }

  function visitLiteral(node: any): void {
    if (typeof node?.value === 'string' && node.value) scanText(node.value);
  }

  function visitTemplateLiteral(node: any): void {
    for (const quasi of node?.quasis ?? []) {
      const text = quasi?.value?.cooked ?? quasi?.value?.raw;
      if (typeof text === 'string' && text) scanText(text);
    }
  }

  function stateFor(provider: string): ProviderState {
    const s = states.find((st) => st.anchor.provider === provider);
    if (!s) throw new Error(`client-tracker: provider "${provider}" is not among this tracker's anchors`);
    return s;
  }

  /**
   * Root expression (+ leading this-prop segment) of whatever the caller
   * passed. Unwinds member chains AND fluent call chains, so
   * `supabase.from('x').select().single()` resolves to the `supabase`
   * identifier. Stops early when a link is itself a recognized client
   * construction (`new Twilio(...).messages.create()`).
   */
  /**
   * Every call seen in this file, with its source span.
   *
   * Some rules anchor their report on an argument rather than the call — the
   * from-address literal, an options object — and an argument has no receiver
   * to attribute. The AST oxlint hands a rule has no parent pointers, so the
   * enclosing call is recovered by span containment instead.
   */
  const callSpans: Array<{ start: number; end: number; node: any }> = [];
  /** Spans of every function body, for the same-scope bound in enclosingCall. */
  const functionSpans: Array<{ start: number; end: number }> = [];

  function visitCallSpan(node: any): void {
    if (typeof node?.start === 'number' && typeof node?.end === 'number') {
      callSpans.push({ start: node.start, end: node.end, node });
    }
  }

  function visitFunctionSpan(node: any): void {
    if (typeof node?.start === 'number' && typeof node?.end === 'number') {
      functionSpans.push({ start: node.start, end: node.end });
    }
  }

  /**
   * Innermost call whose span contains `node`, or null — but never across a
   * function boundary. A call that wraps the *function* containing the node
   * (`internalAction({ handler: async () => { …node… } })`, `router.post(...)`,
   * any higher-order wrapper) is scaffolding, not the expression the rule
   * flagged; attributing the finding to the wrapper's callee misattributes it
   * to whatever framework the wrapper came from.
   */
  function enclosingCall(node: any): any {
    if (typeof node?.start !== 'number' || typeof node?.end !== 'number') return null;
    let fn: { start: number; end: number } | null = null;
    for (const f of functionSpans) {
      if (f.start > node.start || f.end < node.end) continue;
      if (!fn || f.end - f.start < fn.end - fn.start) fn = f;
    }
    let best: { start: number; end: number; node: any } | null = null;
    for (const c of callSpans) {
      if (c.start > node.start || c.end < node.end) continue;
      if (c.node === node) continue;
      if (fn && (c.start < fn.start || c.end > fn.end)) continue;
      if (!best || c.end - c.start < best.end - best.start) best = c;
    }
    return best?.node ?? null;
  }

  /**
   * Descends from the node a rule chose to report to the expression whose
   * receiver identifies the client.
   *
   * Rules anchor their report wherever reads best — the whole statement, the
   * declarator, the returned expression — so a post-hoc ownership check has to
   * find the call underneath before `rootOf` can walk it. Without this, a
   * report on `await stubDb.from('u').insert(...)` (an ExpressionStatement)
   * yields no root at all and is never attributable.
   *
   * Bounded so a malformed tree cannot spin.
   */
  function reportedExpression(node: any): any {
    let n = node;
    for (let guard = 0; guard < 16 && n; guard++) {
      switch (n.type) {
        case 'ExpressionStatement':
          n = n.expression;
          continue;
        case 'VariableDeclaration':
          n = n.declarations?.[0];
          continue;
        case 'VariableDeclarator':
          n = n.init;
          continue;
        case 'ReturnStatement':
        case 'ThrowStatement':
          n = n.argument;
          continue;
        case 'Property':
          n = n.value;
          continue;
        case 'AssignmentExpression':
          n = n.right;
          continue;
        // `await client.from(...)` — the receiver is under the await, and
        // `unwrapExpr` deliberately only strips type/chain wrappers.
        case 'AwaitExpression':
          n = n.argument;
          continue;
        default:
          return n;
      }
    }
    return n;
  }

  function rootOf(node: any): { root: any; firstSegment: string | null } {
    let n = unwrapExpr(node);
    let firstSegment: string | null = null;
    for (let guard = 0; guard < 64; guard++) {
      if (n?.type === 'CallExpression' || n?.type === 'NewExpression') {
        if (states.some((s) => isClientConstruction(n, s))) return { root: n, firstSegment };
        const chain = calleeChain(n.callee);
        if (!chain) return { root: n, firstSegment };
        if (chain.segments.length) firstSegment = chain.segments[0];
        n = unwrapExpr(chain.root);
        continue;
      }
      if (n?.type === 'MemberExpression') {
        const chain = calleeChain(n);
        if (!chain) return { root: n, firstSegment };
        if (chain.segments.length) firstSegment = chain.segments[0];
        n = unwrapExpr(chain.root);
        continue;
      }
      return { root: n, firstSegment };
    }
    return { root: n, firstSegment };
  }

  function ownershipIn(s: ProviderState, root: any, firstSegment: string | null): 'verified' | 'named' | null {
    if (!root) return null;
    if (root.type === 'Identifier') {
      if (s.clientVars.has(root.name)) return 'verified';
      if (isClientConstruction(root, s)) return 'verified';
      if (s.namedVars.has(root.name) || s.anchor.clientNamePattern?.test(root.name)) return 'named';
      return null;
    }
    if (root.type === 'ThisExpression' && firstSegment !== null) {
      return s.thisClientProps.has(firstSegment) ? 'verified' : null;
    }
    if (root.type === 'NewExpression' || root.type === 'CallExpression') {
      return isClientConstruction(root, s) ? 'verified' : null;
    }
    return null;
  }

  /**
   * Merge the CLI's cross-file findings into this file's state.
   *
   * Only ever adds: a binding the CLI verified becomes a `clientVars` entry
   * (verified tier) and marks the provider as directly evidenced. Nothing is
   * removed, so a stale or partial map can never silence a rule.
   */
  function applyVerifiedBindings(): void {
    if (!filename) return;
    for (const s of states) {
      const names = clientBindingsFor(s.anchor.provider, filename);
      if (names && names.size) {
        for (const n of names) s.clientVars.add(n);
        s.direct = true;
      }
      const denied = nonClientBindingsFor(s.anchor.provider, filename);
      if (denied) for (const n of denied) s.nonClientVars.add(n);
    }
  }

  function finalize(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [to, from] of aliases) {
        for (const s of states) {
          if (s.clientVars.has(from) && !s.clientVars.has(to)) {
            s.clientVars.add(to);
            changed = true;
          }
          if (s.namedVars.has(from) && !s.namedVars.has(to)) {
            s.namedVars.add(to);
            changed = true;
          }
        }
      }
    }
  }

  // Seed from the CLI's cross-file resolution before any visitor runs:
  // per-call ownership checks happen during the walk, not at Program:exit.
  applyVerifiedBindings();

  return {
    visitors() {
      const visitors: Record<string, (node: any) => void> = {
        ImportDeclaration: visitImport,
        VariableDeclarator: visitVariableDeclarator,
        AssignmentExpression: visitAssignment,
        PropertyDefinition: visitPropertyDefinition,
        NewExpression: visitConstructionEvidence,
        CallExpression: visitCallSpan,
        Literal: visitLiteral,
        TemplateLiteral: visitTemplateLiteral,
        FunctionDeclaration: visitFunctionSpan,
        FunctionExpression: visitFunctionSpan,
        ArrowFunctionExpression: visitFunctionSpan,
      };
      // Property/member handlers fire on nearly every node in a file — only
      // pay for them when some anchor actually declares identifier evidence.
      if (states.some((s) => s.anchor.identifierPattern)) {
        visitors.Property = visitPropertyKey;
        visitors.MemberExpression = visitMemberProp;
      }
      return visitors;
    },
    finalize,
    hasDirectEvidence(provider: string): boolean {
      return stateFor(provider).direct;
    },
    hasFileEvidence(provider: string): boolean {
      const s = stateFor(provider);
      return s.direct || s.literal;
    },
    resolveOwner(node: any): Ownership {
      const { root, firstSegment } = rootOf(node);
      for (const s of states) {
        if (ownershipIn(s, root, firstSegment) === 'verified') {
          return { tier: 'verified', provider: s.anchor.provider };
        }
      }
      for (const s of states) {
        if (ownershipIn(s, root, firstSegment) === 'named') {
          return { tier: 'named', provider: s.anchor.provider };
        }
      }
      return { tier: 'unknown' };
    },
    deniedFor(node: any, provider: string): boolean {
      const target = stateFor(provider);
      let { root, firstSegment } = rootOf(reportedExpression(node));
      // Reported on an argument (a from-address literal, an options object)?
      // There is no receiver there — fall back to the call that contains it.
      if (root?.type !== 'Identifier' && ownershipIn(target, root, firstSegment) === null) {
        const call = enclosingCall(node);
        if (call) ({ root, firstSegment } = rootOf(call));
      }
      // A denial is a claim about a receiver: "the client this method was
      // called on is verifiably someone else's". Without a method segment
      // there is no receiver claim to refute — a bare call (`setCookie(token)`,
      // `fetch(url)`) was flagged for its arguments or data flow, and foreign
      // attribution of the callee itself proves nothing about the finding.
      if (firstSegment === null) return false;
      if (root?.type === 'Identifier' && target.nonClientVars.has(root.name)) return true;
      if (ownershipIn(target, root, firstSegment) !== null) return false; // ours
      for (const s of states) {
        if (s === target) continue;
        if (ownershipIn(s, root, firstSegment) !== null) return true; // verifiably someone else's
      }
      return false; // unknown → never deny
    },
    belongsTo(node: any, provider: string): boolean {
      const target = stateFor(provider);
      const { root, firstSegment } = rootOf(node);
      // Positively traced to something else — the only case where file-level
      // evidence is overruled.
      if (root?.type === 'Identifier' && target.nonClientVars.has(root.name)) return false;
      const own = ownershipIn(target, root, firstSegment);
      if (own === 'verified') return true;
      for (const s of states) {
        if (s === target) continue;
        if (ownershipIn(s, root, firstSegment) === 'verified') return false;
      }
      if (own === 'named') return true;
      for (const s of states) {
        if (s === target) continue;
        if (ownershipIn(s, root, firstSegment) === 'named') return false;
      }
      return target.direct;
    },
  };
}

/**
 * Merges rule visitors so several handlers can observe the same node types.
 * Handlers run in argument order; for `Program:exit` that means a rule's own
 * exit (which emits its buffered reports) runs before the gate's decision.
 */
export function mergeVisitors(
  ...visitorObjects: Array<Record<string, (node: any) => void> | null | undefined>
): Record<string, (node: any) => void> {
  const merged: Record<string, Array<(node: any) => void>> = {};
  for (const visitors of visitorObjects) {
    if (!visitors) continue;
    for (const [key, handler] of Object.entries(visitors)) {
      if (typeof handler !== 'function') continue;
      (merged[key] ??= []).push(handler);
    }
  }
  const out: Record<string, (node: any) => void> = {};
  for (const [key, handlers] of Object.entries(merged)) {
    out[key] =
      handlers.length === 1
        ? handlers[0]
        : (node: any) => {
            for (const h of handlers) h(node);
          };
  }
  return out;
}
