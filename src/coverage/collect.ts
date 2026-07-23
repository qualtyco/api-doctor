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
    } else if (spec.type === 'ImportDefaultSpecifier') {
      facts.moduleImports.push({ local, imported: 'default', source });
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
    for (const spec of node.specifiers ?? []) {
      const local = spec.local?.name ?? spec.local?.value;
      const exported = spec.exported?.name ?? spec.exported?.value;
      if (local && exported) facts.exportedNames.push({ exported, local });
    }
    return;
  }
  if (node.type === 'ExportDefaultDeclaration') {
    const decl = unwrapExpr(node.declaration);
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
  };

  walkAst(program, (node) => {
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
          if (init.type === 'Identifier') facts.aliases.push([node.id.name, init.name]);
          else facts.newAssigns.push({ name: node.id.name, init });
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

function computeExports(file: ParsedFile, surface: ProviderSurface): void {
  const { facts } = file;
  for (const name of facts.sdkCtorReexports) file.ctorExports.add(name);
  for (const { exported, local } of facts.exportedNames) {
    if (facts.clientVars.has(local)) file.clientExports.add(exported);
    if (facts.ctorLocals.has(local)) file.ctorExports.add(exported);
  }
  for (const { exported, init } of facts.exportedInits) {
    if (isClientConstruction(init, facts, surface)) file.clientExports.add(exported);
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
      resolveLocalBindings(file.facts, surface);
      computeExports(file, surface);
    }

    // Phase B: wrapper consumers — files importing a module whose stem matches
    // a client-exporting file or the provider's client-name pattern. The stem
    // match is only a prefilter; trust requires resolving to a verified export.
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
        resolveLocalBindings(file.facts, surface);
        parsed.push(file);
        parsedPaths.add(relPath);
      }
    }

    // Cross-module resolution: trust wrapper imports only when they resolve to
    // a file that verifiably exports a client or the SDK constructor.
    const byPath = new Map<string, ParsedFile>();
    for (const file of parsed) {
      byPath.set(normalizePath(file.relPath).replace(/\.[cm]?[jt]sx?$/, ''), file);
    }
    for (const file of parsed) {
      let added = false;
      for (const { local, imported, source } of file.facts.moduleImports) {
        const target = resolveImportTarget(source, file.relPath, byPath);
        if (!target) continue;
        if (target.clientExports.has(imported)) {
          file.facts.clientVars.add(local);
          added = true;
        } else if (target.ctorExports.has(imported)) {
          file.facts.ctorLocals.add(local);
          added = true;
        }
      }
      if (added) resolveLocalBindings(file.facts, surface);
    }

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
