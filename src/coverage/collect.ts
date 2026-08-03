/**
 * SDK surface coverage collection.
 *
 * Coverage records which documented SDK method paths a codebase actually
 * calls per provider. It is informational only: it never produces findings,
 * never affects the score, and deliberately reports no available/unused
 * lists, counts, or ratios — using a small part of an API is a fit, not a gap.
 *
 * Runs entirely in the CLI process. The oxlint plugin must never import this
 * module — dist/plugin.js stays lint-only. Files are parsed with oxc-parser,
 * the same parser family oxlint uses.
 *
 * Client identity is verified, never assumed from names alone. A binding
 * counts as a client only when it traces to the SDK: constructed from an
 * imported constructor in the same file, or imported from a project module
 * that verifiably exports such a client (`export const resend = new
 * Resend(...)` in `lib/resend.ts`). Wrapper imports that cannot be resolved
 * to a verified exporter are dropped, not guessed.
 *
 * Deliberate punts (kept so `used` stays a closed vocabulary of documented
 * method names, which is what makes the data privacy-safe and aggregatable):
 *   - destructured resources: `const { emails } = resend; emails.send()`
 *   - clients received as function parameters or via DI containers
 *   - re-export chains deeper than one module (wrapper re-exporting a wrapper)
 *   - wrapper modules outside the scanned tree (npm packages, monorepo siblings)
 *   - non-literal computed access: `resend[method]()`
 *   - `.call` / `.apply` / `.bind`
 * Shape-only matching (counting any `x.emails.send()` regardless of what `x`
 * is, as the lint rules do) was rejected: too collision-prone for
 * telemetry-grade data.
 *
 * Undercounting from these punts is measurable, not silent: every call made
 * on a *verified* client whose path is not in the surface manifest increments
 * `unknownSdkCalls` (a count only — method names never leave the closed
 * vocabulary). A rising unknown-call count across installs means the surface
 * list has drifted behind the SDK or the detector is missing patterns.
 */
import { parseSync } from 'oxc-parser';
import type { CoverageCollection, DetectedProvider, ProviderSurface } from '../types.js';
import { providers } from '../providers/index.js';
import { walkAst } from './walk.js';

/** Unwraps TS/chain wrappers: `expr!`, `expr as T`, `expr satisfies T`, `expr?.`, parens. */
function unwrapExpr(node: any): any {
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
function memberPropName(member: any): string | null {
  if (member?.type !== 'MemberExpression') return null;
  const prop = member.property;
  if (!member.computed && prop?.type === 'Identifier') return prop.name;
  if (member.computed && prop?.type === 'Literal' && typeof prop.value === 'string') {
    return prop.value;
  }
  return null;
}

/** True when the file path looks like a test file (mock-driven calls are not integration usage). */
function isInsideTestFile(filename: string): boolean {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles one import-matcher per surface — the pattern depends only on the
 * package names, so it is built once per provider rather than per file.
 */
function sdkImportMatcher(surface: ProviderSurface): RegExp {
  const alternatives = surface.packages.map(escapeRegExp).join('|');
  return new RegExp(`(from\\s+|require\\(\\s*)['"](${alternatives})['"]`);
}

const IMPORT_SOURCE_RE = /(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;

/** Last path segment of an import source, without a file extension. */
function importSourceStem(source: string): string {
  const base = source.split('/').pop() ?? '';
  return base.replace(/\.[cm]?[jt]sx?$/, '');
}

/** If `init` is `require('<source>')`, returns the source string. */
function requireSource(init: any): string | null {
  if (init?.type !== 'CallExpression') return null;
  if (init.callee?.type !== 'Identifier' || init.callee.name !== 'require') return null;
  const arg = init.arguments?.[0];
  return arg?.type === 'Literal' && typeof arg.value === 'string' ? arg.value : null;
}

interface FileFacts {
  /** Local names bound to a client constructor (e.g. `Resend`, `R`). */
  ctorLocals: Set<string>;
  /** Local names bound to the SDK module namespace (`import * as sdk`, `require('resend')`). */
  nsLocals: Set<string>;
  /** Local names holding a verified client instance. */
  clientVars: Set<string>;
  /** `this.<prop>` properties holding a client instance. */
  thisClientProps: Set<string>;
  /** `const alias = other` pairs, resolved by fixed-point after the walk. */
  aliases: Array<[string, string]>;
  /** `<name> = <init>` bindings whose init may be a client construction. */
  newAssigns: Array<{ name: string; init: any }>;
  /** `this.<prop> = <init>` / class-field bindings. */
  thisNewAssigns: Array<{ prop: string; init: any }>;
  /** Candidate `<root>.<a>...(...)` calls, resolved after the walk. */
  calls: Array<{ root: any; segments: string[] }>;
  /** Named/default imports from non-SDK sources — resolved cross-module later. */
  moduleImports: Array<{ local: string; imported: string; source: string }>;
  /** `export <name>` → the local binding it exposes. */
  exportedNames: Array<{ exported: string; local: string }>;
  /** `export default <expr>` / `module.exports.x = <expr>` initializers. */
  exportedInits: Array<{ exported: string; init: any }>;
  /** `export { Resend } from 'resend'` — constructor re-exported straight from the SDK. */
  sdkCtorReexports: Set<string>;
  /**
   * Named functions whose return value is a client: `function db() { return cached }`.
   * The lazy-singleton factory is the most common way production code shares a
   * client, so callers of these count as holding one.
   */
  clientFactoryLocals: Set<string>;
  /** Function bodies parked for a second pass, once clientVars is settled. */
  functionNodes: Array<{ name: string; node: any }>;
  /**
   * Bindings positively traced to a NON-provider origin: an import from another
   * vendor's package, or from a project module that exports no client. Used to
   * rule a receiver out — never to rule one in.
   */
  nonClientLocals: Set<string>;
  /** Bare-package imports: local -> package, kept for the negative check. */
  packageImports: Array<{ local: string; source: string }>;
  /** `const { supabase } = <expr>` — names pulled off a client-bearing value. */
  destructures: Array<{ names: string[]; from: any }>;
}

interface ParsedFile {
  relPath: string;
  content: string;
  facts: FileFacts;
  /** Export names verified to hold a client instance ('default' for default exports). */
  clientExports: Set<string>;
  /** Export names verified to be the SDK client constructor. */
  ctorExports: Set<string>;
}

/** True when `node` constructs (or factory-calls) a provider client. */
function isClientConstruction(node: any, facts: FileFacts, surface: ProviderSurface): boolean {
  const n = unwrapExpr(node);
  if (n?.type !== 'NewExpression' && n?.type !== 'CallExpression') return false;
  const callee = unwrapExpr(n.callee);
  if (callee?.type === 'Identifier') return facts.ctorLocals.has(callee.name);
  if (callee?.type === 'MemberExpression') {
    const obj = unwrapExpr(callee.object);
    const prop = memberPropName(callee);
    return (
      obj?.type === 'Identifier' &&
      facts.nsLocals.has(obj.name) &&
      prop !== null &&
      surface.clientConstructors.includes(prop)
    );
  }
  return false;
}

/** Splits a callee into its root expression and dotted member segments. */
function calleeChain(callee: any): { root: any; segments: string[] } | null {
  const segments: string[] = [];
  let n = unwrapExpr(callee);
  while (n?.type === 'MemberExpression') {
    const name = memberPropName(n);
    if (name === null) return null;
    segments.unshift(name);
    n = unwrapExpr(n.object);
  }
  return segments.length ? { root: n, segments } : null;
}

function visitImport(node: any, surface: ProviderSurface, facts: FileFacts): void {
  const source = node.source?.value;
  if (typeof source !== 'string') return;
  const fromSdk = surface.packages.includes(source);
  for (const spec of node.specifiers ?? []) {
    const local = spec.local?.name;
    if (!local) continue;
    if (fromSdk) {
      if (spec.type === 'ImportSpecifier') {
        const imported = spec.imported?.name ?? spec.imported?.value;
        if (surface.clientConstructors.includes(imported)) facts.ctorLocals.add(local);
      } else if (spec.type === 'ImportNamespaceSpecifier') {
        facts.nsLocals.add(local);
      } else if (spec.type === 'ImportDefaultSpecifier') {
        if (surface.clientConstructors.includes(local)) facts.ctorLocals.add(local);
        else facts.nsLocals.add(local);
      }
    } else if (spec.type === 'ImportSpecifier') {
      const imported = spec.imported?.name ?? spec.imported?.value;
      facts.moduleImports.push({ local, imported, source });
      if (!source.startsWith('.')) facts.packageImports.push({ local, source });
    } else if (spec.type === 'ImportDefaultSpecifier') {
      facts.moduleImports.push({ local, imported: 'default', source });
      if (!source.startsWith('.')) facts.packageImports.push({ local, source });
    }
    // Namespace imports of wrapper modules (`import * as mail from './lib'`)
    // are a punt — resolving `mail.resend.emails.send` would need per-member
    // export tracking for little real-world payoff.
  }
}

function visitExport(node: any, surface: ProviderSurface, facts: FileFacts): void {
  if (node.type === 'ExportNamedDeclaration') {
    const source = node.source?.value;
    if (typeof source === 'string') {
      // Only direct SDK re-exports are trusted; deeper chains are a punt.
      if (surface.packages.includes(source)) {
        for (const spec of node.specifiers ?? []) {
          const local = spec.local?.name ?? spec.local?.value;
          const exported = spec.exported?.name ?? spec.exported?.value;
          if (local && exported && surface.clientConstructors.includes(local)) {
            facts.sdkCtorReexports.add(exported);
          }
        }
      }
      return;
    }
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations ?? []) {
        if (decl.id?.type === 'Identifier') {
          facts.exportedNames.push({ exported: decl.id.name, local: decl.id.name });
        }
      }
      return;
    }
    // `export function db() { … }` / `export class Db { … }` — the lazy-factory
    // form. Without this the most common way to share a client is invisible.
    if (
      (node.declaration?.type === 'FunctionDeclaration' ||
        node.declaration?.type === 'ClassDeclaration') &&
      node.declaration.id?.type === 'Identifier'
    ) {
      const name = node.declaration.id.name;
      facts.exportedNames.push({ exported: name, local: name });
      return;
    }
    for (const spec of node.specifiers ?? []) {
      const local = spec.local?.name ?? spec.local?.value;
      const exported = spec.exported?.name ?? spec.exported?.value;
      if (local && exported) facts.exportedNames.push({ exported, local });
    }
    return;
  }
  if (node.type === 'ExportDefaultDeclaration') {
    const decl = unwrapExpr(node.declaration);
    if (decl?.type === 'FunctionDeclaration' && decl.id?.type === 'Identifier') {
      facts.exportedNames.push({ exported: 'default', local: decl.id.name });
      return;
    }
    if (decl?.type === 'Identifier') {
      facts.exportedNames.push({ exported: 'default', local: decl.name });
    } else if (decl) {
      facts.exportedInits.push({ exported: 'default', init: decl });
    }
  }
}

/** `module.exports = {...}` / `module.exports.x = ...` / `exports.x = ...`. */
function visitCjsExport(left: any, right: any, facts: FileFacts): boolean {
  const isModuleExports = (n: any): boolean =>
    n?.type === 'MemberExpression' &&
    unwrapExpr(n.object)?.type === 'Identifier' &&
    unwrapExpr(n.object).name === 'module' &&
    memberPropName(n) === 'exports';
  const record = (exported: string, value: any): void => {
    const v = unwrapExpr(value);
    if (v?.type === 'Identifier') facts.exportedNames.push({ exported, local: v.name });
    else if (v) facts.exportedInits.push({ exported, init: v });
  };

  if (isModuleExports(left)) {
    const r = unwrapExpr(right);
    if (r?.type === 'ObjectExpression') {
      for (const p of r.properties ?? []) {
        if (p?.type === 'Property' && p.key?.type === 'Identifier') record(p.key.name, p.value);
      }
    } else {
      record('default', right);
    }
    return true;
  }
  if (left?.type === 'MemberExpression') {
    const obj = unwrapExpr(left.object);
    const prop = memberPropName(left);
    if (prop && (isModuleExports(obj) || (obj?.type === 'Identifier' && obj.name === 'exports'))) {
      record(prop, right);
      return true;
    }
  }
  return false;
}

function collectFileFacts(program: any, surface: ProviderSurface): FileFacts {
  const facts: FileFacts = {
    ctorLocals: new Set(),
    nsLocals: new Set(),
    clientVars: new Set(),
    thisClientProps: new Set(),
    aliases: [],
    newAssigns: [],
    thisNewAssigns: [],
    calls: [],
    moduleImports: [],
    exportedNames: [],
    exportedInits: [],
    sdkCtorReexports: new Set(),
    clientFactoryLocals: new Set(),
    functionNodes: [],
    nonClientLocals: new Set(),
    packageImports: [],
    destructures: [],
  };

  walkAst(program, (node) => {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      let name: string | null = null;
      if (node.id?.type === 'Identifier') name = node.id.name;
      else if (node.parent?.type === 'VariableDeclarator' && node.parent.id?.type === 'Identifier') {
        name = node.parent.id.name;
      }
      if (name) facts.functionNodes.push({ name, node });
    }
    switch (node.type) {
      case 'ImportDeclaration': {
        visitImport(node, surface, facts);
        break;
      }
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration': {
        visitExport(node, surface, facts);
        break;
      }
      case 'VariableDeclarator': {
        const init = unwrapExpr(node.init);
        if (!init) break;
        const source = requireSource(init);
        if (source !== null && surface.packages.includes(source)) {
          if (node.id?.type === 'Identifier') {
            facts.nsLocals.add(node.id.name);
          } else if (node.id?.type === 'ObjectPattern') {
            for (const p of node.id.properties ?? []) {
              if (
                p?.type === 'Property' &&
                p.key?.type === 'Identifier' &&
                surface.clientConstructors.includes(p.key.name) &&
                p.value?.type === 'Identifier'
              ) {
                facts.ctorLocals.add(p.value.name);
              }
            }
          }
        } else if (node.id?.type === 'Identifier') {
          // `const createClient = async () => {…}` — the walker carries no
          // parent pointers, so the name has to be taken here or the function
          // is never attributable.
          if (
            init.type === 'FunctionExpression' ||
            init.type === 'ArrowFunctionExpression'
          ) {
            facts.functionNodes.push({ name: node.id.name, node: init });
          }
          if (init.type === 'Identifier') facts.aliases.push([node.id.name, init.name]);
          else facts.newAssigns.push({ name: node.id.name, init });
        } else if (node.id?.type === 'ObjectPattern') {
          // `const { supabase } = ctx` — the client arrives as a property of
          // something else, which is how helper functions usually hand it over.
          const names: string[] = [];
          for (const prop of node.id.properties ?? []) {
            if (prop?.type === 'Property' && prop.value?.type === 'Identifier') {
              names.push(prop.value.name);
            }
          }
          if (names.length) facts.destructures.push({ names, from: init });
        }
        break;
      }
      case 'AssignmentExpression': {
        if (node.operator !== '=') break;
        const left = unwrapExpr(node.left);
        const right = unwrapExpr(node.right);
        if (visitCjsExport(left, node.right, facts)) break;
        if (left?.type === 'Identifier') {
          facts.newAssigns.push({ name: left.name, init: right });
        } else if (left?.type === 'MemberExpression' && unwrapExpr(left.object)?.type === 'ThisExpression') {
          const prop = memberPropName(left);
          if (prop !== null) facts.thisNewAssigns.push({ prop, init: right });
        }
        break;
      }
      case 'PropertyDefinition': {
        if (node.key?.type === 'Identifier' && node.value) {
          facts.thisNewAssigns.push({ prop: node.key.name, init: unwrapExpr(node.value) });
        }
        break;
      }
      case 'CallExpression': {
        const chain = calleeChain(node.callee);
        if (chain) facts.calls.push(chain);
        break;
      }
    }
  });

  return facts;
}

/**
 * Resolves same-file client bindings: constructions from local ctor/namespace
 * imports, `this.<p>` assignments, and alias chains. Idempotent — called
 * again after cross-module imports add ctorLocals/clientVars.
 */
/**
 * Extra local shapes that carry a client, applied alongside alias resolution:
 *   const db = getClient();        — call of a local factory
 *   const db = await getClient();  — awaited factory
 *   const db = a ?? b;             — nullish/logical fallback
 *   const { supabase } = ctx;      — destructured off a client-bearing object
 */
function resolveExtraShapes(facts: FileFacts, surface: ProviderSurface): boolean {
  let changed = false;
  for (const { names, from } of facts.destructures) {
    if (names.every((n) => facts.clientVars.has(n))) continue;
    const src = unwrapExpr(from);
    // `const { emails } = resend` pulls a NAMESPACE off a client, not another
    // client, and coverage counts that as a documented punt. Only a container
    // that merely *holds* a client propagates — `const { supabase } = locals`.
    if (src?.type === 'Identifier' && facts.clientVars.has(src.name)) continue;
    if (yieldsClient(src, facts, surface)) {
      for (const n of names) facts.clientVars.add(n);
      changed = true;
    }
  }
  for (const { name, init } of facts.newAssigns) {
    if (facts.clientVars.has(name)) continue;
    const e = unwrapExpr(init);
    if (!e) continue;
    let hit = yieldsClient(e, facts, surface);
    if (!hit && (e.type === 'LogicalExpression' || e.type === 'ConditionalExpression')) {
      const parts = e.type === 'LogicalExpression' ? [e.left, e.right] : [e.consequent, e.alternate];
      hit = parts.some((x: any) => yieldsClient(unwrapExpr(x), facts, surface));
    }
    if (hit) {
      facts.clientVars.add(name);
      changed = true;
    }
  }
  return changed;
}

function resolveLocalBindings(facts: FileFacts, surface: ProviderSurface): void {
  for (const { name, init } of facts.newAssigns) {
    if (isClientConstruction(init, facts, surface)) facts.clientVars.add(name);
  }
  for (const { prop, init } of facts.thisNewAssigns) {
    if (isClientConstruction(init, facts, surface)) facts.thisClientProps.add(prop);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [to, from] of facts.aliases) {
      if (facts.clientVars.has(from) && !facts.clientVars.has(to)) {
        facts.clientVars.add(to);
        changed = true;
      }
    }
  }
}

/** Normalizes a path to posix separators and resolves `.`/`..` segments. */
function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split(/[\\/]/)) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Resolves an import source to a parsed project file, or null. Relative
 * sources resolve exactly; tsconfig-style aliases (`@/x`, `~/x`) and
 * root-relative sources resolve by unique path suffix. Ambiguous or
 * unresolvable sources return null — a wrapper we cannot verify is a wrapper
 * we do not trust.
 */
/**
 * True when `source` names a file that exists in the project but was never
 * parsed for this provider.
 *
 * Phase A parses every file containing an SDK reference, and Phase B pulls in
 * anything importing a known exporter, iterating to a fixpoint — so a project
 * file still absent from `byPath` provably holds no client. That makes it safe
 * negative evidence: a binding imported from it is not this provider's client.
 */
function resolvesToUnparsedProjectFile(
  source: string,
  fromPath: string,
  byPath: Map<string, ParsedFile>,
  projectPaths: Set<string>,
): boolean {
  if (!isProjectSpecifier(source)) return false;
  const src = source.replace(/\.[cm]?[jt]sx?$/, '');
  if (src.startsWith('.')) {
    const dir = normalizePath(fromPath).split('/').slice(0, -1).join('/');
    const target = normalizePath(`${dir}/${src}`);
    if (byPath.has(target) || byPath.has(`${target}/index`)) return false;
    return projectPaths.has(target) || projectPaths.has(`${target}/index`);
  }
  // Alias form — match by suffix, the same way resolveImportTarget does, and
  // only deny when exactly one project file matches and it was never parsed.
  const bare = src.replace(/^[@~]\//, '').replace(/^[$#][^/]*\//, '');
  const hits = [...projectPaths].filter((p) => p === bare || p.endsWith(`/${bare}`));
  if (hits.length !== 1) return false;
  return !byPath.has(hits[0]) && !byPath.has(`${hits[0]}/index`);
}

/**
 * True when a specifier points inside the project rather than at a package:
 * a relative path, or a path alias (`@/x`, `~/x`, `$lib/x`, `#x`).
 *
 * `@/lib/supabase` is an alias, `@supabase/supabase-js` is a package — the
 * distinction is the slash straight after `@`.
 */
function isProjectSpecifier(source: string): boolean {
  return (
    source.startsWith('.') ||
    source.startsWith('@/') ||
    source.startsWith('~/') ||
    source.startsWith('#') ||
    /^\$[^/]+\//.test(source)
  );
}

function resolveImportTarget(
  source: string,
  fromPath: string,
  byPath: Map<string, ParsedFile>,
): ParsedFile | null {
  const src = source.replace(/\.[cm]?[jt]sx?$/, '');
  if (src.startsWith('.')) {
    const dir = normalizePath(fromPath).split('/').slice(0, -1).join('/');
    const target = normalizePath(`${dir}/${src}`);
    return byPath.get(target) ?? byPath.get(`${target}/index`) ?? null;
  }
  const candidates = [src];
  if (/^[@~]\//.test(src)) candidates.push(src.slice(2));
  // Framework aliases resolved by convention rather than tsconfig:
  //   SvelteKit `$lib/x` → src/lib/x, Nuxt `~/x`, Vite `#x`.
  // Stripping the alias segment is enough — the matcher below is suffix-based.
  if (/^[$#]/.test(src)) {
    const stripped = src.replace(/^[$#][^/]*\//, '');
    if (stripped && stripped !== src) candidates.push(stripped);
  }
  for (const cand of candidates) {
    const matches = [...byPath.keys()].filter(
      (p) =>
        p === cand ||
        p.endsWith(`/${cand}`) ||
        p === `${cand}/index` ||
        p.endsWith(`/${cand}/index`),
    );
    if (matches.length === 1) return byPath.get(matches[0]) ?? null;
    if (matches.length > 1) return null;
  }
  return null;
}

function parseFile(relPath: string, content: string, surface: ProviderSurface): ParsedFile | null {
  // Covers the walk as well as the parse: a file that cannot be analysed is
  // dropped from coverage, never allowed to fail the scan.
  try {
    const program = parseSync(relPath, content).program;
    if (!program) return null;
    const facts = collectFileFacts(program, surface);
    return { relPath, content, facts, clientExports: new Set(), ctorExports: new Set() };
  } catch {
    return null;
  }
}

/** True when `e` evaluates to a client: the binding itself, a construction, or a factory call. */
function yieldsClient(e: any, facts: FileFacts, surface: ProviderSurface): boolean {
  if (!e) return false;
  if (e.type === 'Identifier' && facts.clientVars.has(e.name)) return true;
  if (isClientConstruction(e, facts, surface)) return true;
  // `return dbFactory()` — calling a factory yields a client, so the enclosing
  // function is a factory too. This is what makes wrapper chains resolve.
  if (e.type === 'CallExpression') {
    const callee = unwrapExpr(e.callee);
    // A factory declared here, or one imported from a wrapper module (those
    // arrive in clientVars, since the exporter cannot say which it was).
    if (
      callee?.type === 'Identifier' &&
      (facts.clientFactoryLocals.has(callee.name) || facts.clientVars.has(callee.name))
    ) {
      return true;
    }
  }
  if (e.type === 'AwaitExpression') return yieldsClient(unwrapExpr(e.argument), facts, surface);
  // `const services = { db: makeDb(), mail: makeMail() }` — a container whose
  // properties are clients. Callers reach the client as `services.db.…`, and
  // the chain walker bottoms out at `services`, so the container itself counts.
  if (e.type === 'ObjectExpression') {
    for (const prop of e.properties ?? []) {
      if (prop?.type !== 'Property') continue;
      if (yieldsClient(unwrapExpr(prop.value), facts, surface)) return true;
    }
  }
  return false;
}

/**
 * Marks functions that hand back a client: `function db() { return cached }`
 * or `const get = () => createClient(...)`. Runs after resolveLocalBindings so
 * `clientVars` is already settled.
 */
function findClientFactories(facts: FileFacts, surface: ProviderSurface): void {
  for (const { name, node } of facts.functionNodes) {
    const body = node.body;
    if (!body) continue;
    let yields = false;
    if (body.type !== 'BlockStatement') {
      // arrow shorthand: () => client / () => createClient(...)
      const e = unwrapExpr(body);
      yields = yieldsClient(e, facts, surface);
    } else {
      walkAst(body, (n: any) => {
        if (yields || n.type !== 'ReturnStatement' || !n.argument) return;
        if (yieldsClient(unwrapExpr(n.argument), facts, surface)) yields = true;
      });
    }
    if (yields) facts.clientFactoryLocals.add(name);
  }
}

/** Alias resolution + factories + extra shapes, repeated until nothing new appears. */
function settleBindings(facts: FileFacts, surface: ProviderSurface): void {
  for (let round = 0; round < 6; round++) {
    const before = facts.clientVars.size + facts.clientFactoryLocals.size;
    resolveLocalBindings(facts, surface);
    findClientFactories(facts, surface);
    resolveExtraShapes(facts, surface);
    if (facts.clientVars.size + facts.clientFactoryLocals.size === before) break;
  }
}

function computeExports(file: ParsedFile, surface: ProviderSurface): void {
  const { facts } = file;
  for (const name of facts.sdkCtorReexports) file.ctorExports.add(name);
  for (const { exported, local } of facts.exportedNames) {
    if (facts.clientVars.has(local) || facts.clientFactoryLocals.has(local)) file.clientExports.add(exported);
    if (facts.ctorLocals.has(local)) file.ctorExports.add(exported);
  }
  for (const { exported, init } of facts.exportedInits) {
    if (isClientConstruction(init, facts, surface)) file.clientExports.add(exported);
    // `export const handle = makeDb` — an alias of a factory is still a factory.
    const e = unwrapExpr(init);
    if (e?.type === 'Identifier' && facts.clientFactoryLocals.has(e.name)) {
      file.clientExports.add(exported);
    }
  }
}

function resolveCalls(
  file: ParsedFile,
  surface: ProviderSurface,
  methodSet: Set<string>,
  used: Set<string>,
  counters: { unknown: number },
): void {
  const { facts } = file;
  for (const { root, segments } of facts.calls) {
    let path: string | null = null;
    if (root?.type === 'Identifier' && facts.clientVars.has(root.name)) {
      path = segments.join('.');
    } else if (
      root?.type === 'ThisExpression' &&
      segments.length >= 2 &&
      facts.thisClientProps.has(segments[0])
    ) {
      path = segments.slice(1).join('.');
    } else if (isClientConstruction(root, facts, surface)) {
      path = segments.join('.');
    }
    if (path === null) continue;
    if (methodSet.has(path)) {
      used.add(path);
    } else {
      // A verified client call outside the documented surface: SDK drift or a
      // detector gap. Counted (never named) so undercounting stays visible.
      counters.unknown += 1;
    }
  }
}


/**
 * Parses and cross-resolves every file that could hold a client for `surface`.
 * Shared by coverage collection and by the gate's client-module map, so both
 * see the same verified client identities.
 */
function buildParsedFiles(
  d: DetectedProvider,
  surface: ProviderSurface,
  filesContent: Map<string, string>,
): ParsedFile[] {
    // Phase A: files that reference the SDK directly (detection's list plus a
    // content check, so the pass does not depend on the detector's coverage).
    const sdkImport = sdkImportMatcher(surface);
    const phaseA = new Set(d.files ?? []);
    for (const [file, content] of filesContent) {
      if (!phaseA.has(file) && sdkImport.test(content)) phaseA.add(file);
    }

    const parsed: ParsedFile[] = [];
    /** Paths already parsed — keeps Phase B's skip test O(1). */
    const parsedPaths = new Set<string>();
    for (const relPath of phaseA) {
      if (isInsideTestFile(relPath)) continue;
      const content = filesContent.get(relPath);
      if (content === undefined) continue;
      const file = parseFile(relPath, content, surface);
      if (file) {
        parsed.push(file);
        parsedPaths.add(relPath);
      }
    }
    for (const file of parsed) {
      settleBindings(file.facts, surface);
      computeExports(file, surface);
    }

    // Phase B + cross-module resolution, interleaved and repeated.
    //
    // Discovery and resolution feed each other: resolving `mid.ts` makes it an
    // exporter, which makes `services.ts` a candidate, which once resolved makes
    // *it* an exporter, and so on. Running each phase once stops at the first
    // link, so a client two or three wrappers deep is never found — and that is
    // the shape most projects actually use.
    /** Every project file, extension-stripped — the universe the importer can reach. */
    const projectPaths = new Set<string>();
    for (const relPath of filesContent.keys()) {
      projectPaths.add(normalizePath(relPath).replace(/\.[cm]?[jt]sx?$/, ''));
    }

    const byPath = new Map<string, ParsedFile>();
    const indexParsed = (): void => {
      for (const file of parsed) {
        byPath.set(normalizePath(file.relPath).replace(/\.[cm]?[jt]sx?$/, ''), file);
      }
    };
    indexParsed();

    for (let round = 0; round < 6; round++) {
      let progressed = false;

      // (1) pull in files that import from a known client exporter
      const exporterStems = new Set<string>();
      for (const file of parsed) {
        if (file.clientExports.size === 0 && file.ctorExports.size === 0) continue;
        const segs = normalizePath(file.relPath).split('/');
        const stem = (segs.pop() ?? '').replace(/\.[cm]?[jt]sx?$/, '');
        exporterStems.add(stem === 'index' ? (segs.pop() ?? stem) : stem);
      }
      for (const [relPath, content] of filesContent) {
        if (isInsideTestFile(relPath)) continue;
        if (parsedPaths.has(relPath)) continue;
        let isCandidate = false;
        for (const match of content.matchAll(IMPORT_SOURCE_RE)) {
          const stem = importSourceStem(match[1]);
          if (exporterStems.has(stem) || surface.clientNamePattern.test(stem)) {
            isCandidate = true;
            break;
          }
        }
        if (!isCandidate) continue;
        const file = parseFile(relPath, content, surface);
        if (file) {
          settleBindings(file.facts, surface);
          computeExports(file, surface);
          parsed.push(file);
          parsedPaths.add(relPath);
          progressed = true;
        }
      }
      if (progressed) indexParsed();

      // (2a) negative evidence: a binding whose origin is positively NOT this
      // provider. Two safe sources — an import from another vendor's package,
      // and an import from a project module that exports no client at all.
      // Only ever used to rule a receiver out, so a gap here costs nothing.
      for (const file of parsed) {
        for (const { local, source } of file.facts.packageImports) {
          if (file.facts.clientVars.has(local) || file.facts.ctorLocals.has(local)) continue;
          if (isProjectSpecifier(source)) continue; // an alias, not a package
          if (!surface.packages.some((pkg) => source === pkg || source.startsWith(`${pkg}/`))) {
            file.facts.nonClientLocals.add(local);
          }
        }
        for (const { local, imported, source } of file.facts.moduleImports) {
          if (!isProjectSpecifier(source)) continue;
          if (file.facts.clientVars.has(local) || file.facts.ctorLocals.has(local)) continue;
          const target = resolveImportTarget(source, file.relPath, byPath);
          if (target) {
            // Deny only when the target module is provably unrelated to the
            // provider. "Resolved but this particular export isn't recognised"
            // is not enough: a module can hold a client in a form this pass
            // does not model (a lazy `new Proxy(...)` wrapper, for one), and
            // denying there would silence real findings.
            const targetHasAnyClient =
              target.clientExports.size > 0 ||
              target.ctorExports.size > 0 ||
              target.facts.clientVars.size > 0 ||
              target.facts.ctorLocals.size > 0 ||
              target.facts.clientFactoryLocals.size > 0;
            if (!targetHasAnyClient) file.facts.nonClientLocals.add(local);
            continue;
          }
          // Resolves to a project file that was never parsed → no client in it.
          if (resolvesToUnparsedProjectFile(source, file.relPath, byPath, projectPaths)) {
            file.facts.nonClientLocals.add(local);
          }
          // Anything else is genuinely unresolved → stay silent, never guess.
        }
      }

      // (2b) trust a wrapper import only when it resolves to a verified export
      for (const file of parsed) {
        let added = false;
        for (const { local, imported, source } of file.facts.moduleImports) {
          const target = resolveImportTarget(source, file.relPath, byPath);
          if (!target) continue;
          if (target.clientExports.has(imported) && !file.facts.clientVars.has(local)) {
            file.facts.clientVars.add(local);
            added = true;
          } else if (target.ctorExports.has(imported) && !file.facts.ctorLocals.has(local)) {
            file.facts.ctorLocals.add(local);
            added = true;
          }
        }
        if (added) {
          settleBindings(file.facts, surface);
          computeExports(file, surface);
          progressed = true;
        }
      }

      // (3) propagate: `const store = makeOrm()` where makeOrm is a non-client
      for (const file of parsed) {
        for (const { name, init } of file.facts.newAssigns) {
          if (file.facts.clientVars.has(name)) continue;
          const e = unwrapExpr(init);
          const callee = e?.type === 'CallExpression' ? unwrapExpr(e.callee) : null;
          if (callee?.type === 'Identifier' && file.facts.nonClientLocals.has(callee.name)) {
            file.facts.nonClientLocals.add(name);
          }
        }
      }

      if (!progressed) break;
    }

  return parsed;
}

/**
 * Collects SDK surface usage for every detected provider that declares a
 * surface manifest and was detected via an actual SDK reference. Providers
 * detected from a URL string alone are skipped entirely (there is no client
 * to walk, and an empty `used` would be misleading). Returns undefined when
 * no provider qualifies — the report omits the section rather than emitting
 * an empty one.
 */
export function collectCoverage(
  detected: DetectedProvider[],
  filesContent: Map<string, string>,
): CoverageCollection[] | undefined {
  const coverage: CoverageCollection[] = [];

  for (const d of detected) {
    const surface = providers.find((p) => p.name === d.name)?.surface;
    if (!surface || d.source === 'url-patterns') continue;

    const methodSet = new Set(surface.methods);
    const used = new Set<string>();
    const counters = { unknown: 0 };

    const parsed = buildParsedFiles(d, surface, filesContent);

    for (const file of parsed) {
      resolveCalls(file, surface, methodSet, used, counters);
    }

    coverage.push({
      provider: d.name,
      used: [...used].sort(),
      unknownSdkCalls: counters.unknown,
    });
  }

  return coverage.length ? coverage : undefined;
}


/**
 * Map of file -> verified client binding names, per provider.
 *
 * Same verification as coverage: a binding counts only when it traces to the
 * SDK, including through one wrapper module (`export const db = createClient()`
 * in `lib/db.ts`, imported elsewhere as `db`). This is what lets the lint gate
 * recognise a client that was constructed in a different file — the one thing
 * the plugin-side tracker cannot work out on its own.
 *
 * Consumed additively: it can only add evidence, never remove it, so a gap
 * here degrades to the tracker's existing single-file behaviour.
 */
export function collectClientBindings(
  detected: DetectedProvider[],
  filesContent: Map<string, string>,
): Record<string, Record<string, { yes: string[]; no: string[] }>> {
  const out: Record<string, Record<string, { yes: string[]; no: string[] }>> = {};

  for (const d of detected) {
    const surface = providers.find((p) => p.name === d.name)?.surface;
    if (!surface) continue;

    const perFile: Record<string, { yes: string[]; no: string[] }> = {};
    for (const file of buildParsedFiles(d, surface, filesContent)) {
      const yes = [
        ...file.facts.clientVars,
        ...file.facts.thisClientProps,
        ...file.facts.clientFactoryLocals,
      ];
      const yesSet = new Set(yes);
      const no = [...file.facts.nonClientLocals].filter((n) => !yesSet.has(n));
      if (yes.length || no.length) perFile[normalizePath(file.relPath)] = { yes, no };
    }
    if (Object.keys(perFile).length) out[d.name] = perFile;
  }

  return out;
}
