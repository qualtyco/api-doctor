/**
 * Shared contracts for provider detection, rule mapping, coverage, and scan output.
 */

export type Severity = 'error' | 'warning' | 'info';

export type FindingCategory = 'security' | 'correctness' | 'reliability' | 'compatibility';

export type ReportSeverityLabel = 'excellent' | 'good' | 'needs-work' | 'critical';

/** Languages api-doctor can analyze. */
export type RuleLanguage = 'javascript';

export interface ScanResult {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  snippet: string;
  /** Plugin rule key (e.g. `resend-missing-idempotency-key`) — used for stable finding ids. */
  ruleKey: string;
  rule: string;
  severity: Severity;
  message: string;
  fix: string;
  docsUrl?: string;
  /**
   * Compatibility findings only: what to check before trusting the rewrite.
   * Hand-written on the provider's removal entry and recovered from the
   * rendered message (see providers/index.ts) — absent for every other rule.
   */
  verifyHint?: string;
}

/** Maps a provider rule to message/fix metadata used when reporting findings. */
export interface RuleMeta {
  /** Rule key registered in the engine (e.g. `resend-webhook-signature`). */
  key: string;
  /** Human-readable rule id shown in reports (e.g. `resend/webhook-signature-missing`). */
  resultRule: string;
  message: string;
  fix: string;
  docsUrl?: string;
  severity?: Severity;
  /**
   * Which engines implement this rule.
   * Defaults to `['javascript']` when omitted.
   */
  languages?: RuleLanguage[];
  /**
   * Use the message rendered by the rule at lint time instead of the static
   * `message` above. For rules whose finding must carry per-occurrence facts
   * (e.g. the installed SDK version); the static `message` remains the
   * fallback when the engine yields no message text.
   */
  dynamicMessage?: boolean;
}

/** @deprecated Prefer RuleMeta. Alias kept for gradual migration. */
export type OxlintRuleMeta = RuleMeta;

/** Languages this rule runs on (default javascript-only). */
export function ruleLanguages(rule: RuleMeta): RuleLanguage[] {
  return rule.languages?.length ? rule.languages : ['javascript'];
}

export interface ProviderManifest {
  name: string;
  displayName: string;
  detect: {
    /** npm package names in package.json */
    packages?: string[];
    /** JS/TS import/require module strings */
    imports?: string[];
    urlPatterns?: string[];
  };
  rules: RuleMeta[];
  /** SDK surface description driving coverage collection. Optional — coverage is skipped for providers without one. */
  surface?: ProviderSurface;
  /**
   * Hand-verified symbol removals for this provider's SDK. Optional — a
   * provider has one once someone has compared two published tarballs by hand.
   *
   * Declaring it here is the whole registration: the removals live in
   * `providers/<name>/compatibility.ts`, and everything that needs them across
   * providers (telemetry, the reporter's verify hint) derives from this field
   * via `providers/index.ts`. There is no second list to add a provider to.
   */
  compatibility?: ProviderCompatibility;
}

/**
 * One provider's compatibility data: the package the removals belong to, and
 * the removals themselves.
 *
 * The package name is part of the record because every consumer needs it —
 * the rule resolves the installed version from it, telemetry reports that
 * version — and reading it off the manifest is what keeps those consumers
 * from hardcoding one provider's package.
 *
 * Two lists, because an SDK breaks a caller in two structurally different
 * ways and only one of them is visible at an import. `removals` is the
 * exported-symbol kind (`import { createOrReconfigureBasin }`); `methodRemovals`
 * is the call-path kind (`supabase.auth.signIn(...)`), where nothing about the
 * import statement changed and the break is in a method that is simply no
 * longer there. Most HTTP SDKs — anything Fern-, Stainless- or
 * resource-client-shaped — break the second way, so a provider that only
 * modelled the first would be silent on its own major version bump.
 */
export interface ProviderCompatibility {
  /** npm package the removals apply to (e.g. '@s2-dev/streamstore'). */
  package: string;
  removals: SymbolRemoval[];
  /**
   * Removed method paths off a client instance. Optional — a provider has
   * these once someone has compared two published tarballs by hand.
   */
  methodRemovals?: MethodRemoval[];
}

/**
 * The hand-verified facts every removal carries, whatever its shape.
 *
 * Split out so a `MethodRemoval` cannot be written to a laxer standard than a
 * `SymbolRemoval`: both answer "when did it go", "what replaced it", "does the
 * replacement do the same thing on the wire", "where did you check", and "what
 * must the reader verify". The discipline test in
 * `tests/reporter/verify-hint.test.ts` iterates both lists through this shape.
 */
export interface RemovalFacts {
  /** First version in which the symbol or method no longer exists. */
  removedIn: string;
  /** Replacement, when exactly one exists. */
  replacement?: string;
  /**
   * Replacements when the old entry point was split into several. Set with
   * `kind: 'split'`; the message lists them and never guesses which one a
   * given call site meant, because only the arguments decide.
   */
  replacements?: string[];
  /**
   * `rename`           — same thing, new name.
   * `signature-change` — same name reachable, different contract.
   * `moved`            — same name and behaviour, different import module.
   * `split`            — one entry point became several; the caller chooses.
   * `removed`          — gone, with no drop-in successor.
   */
  kind: 'rename' | 'signature-change' | 'moved' | 'split' | 'removed';
  /**
   * Old and new make the identical wire call — set by hand only.
   *
   * Asserts same HTTP method, same URL path, same auth, same request shape,
   * established by reading both builders. Never inferred from a rename, and
   * meaningless for a library with no wire call at all (a client-side editor,
   * say) — those entries are always `false`.
   */
  wireIdentical: boolean;
  /** Date the tarball comparison was performed. */
  verifiedAt: string;
  /** Where in the published package the removal was confirmed. */
  evidence: string;
  /**
   * What to check before trusting the rewrite, in the reader's terms. Shown to
   * the developer and to the agent as a separate labelled line — the message
   * says what changed, this says what to verify.
   *
   * Hand-written per entry, never generated from a diff or inferred from a
   * changelog — the same discipline `wireIdentical` and `evidence` already
   * require. Two rules for writing one:
   *
   *   - `wireIdentical: true` → say so explicitly and name what is identical
   *     (method, path, auth, request shape), so the reader can stop looking.
   *   - anything else (signature or behavior change) → name the specific thing
   *     that can differ and how to test it, e.g. "the old call retried
   *     automatically on 5xx and the new one does not — check that retry logic
   *     wraps this call site now".
   *
   * "Verify carefully" is not a hint. If there is nothing concrete to name,
   * the entry is not verified enough to ship.
   */
  verifyHint: string;
}

/**
 * An exported symbol that no longer exists in some version of a provider's SDK.
 *
 * Every field is hand-verified against the published tarballs — implementation,
 * not just the type diff. See `providers/s2/compatibility.ts` for the worked
 * example and `RemovalFacts` for the rules on writing `verifyHint`.
 */
export interface SymbolRemoval extends RemovalFacts {
  /** Exported symbol name as it appeared in the SDK. */
  symbol: string;
  /**
   * Module the symbol moved to, when it still exists under the same name at a
   * different import path (`@tiptap/react` → `@tiptap/react/menus`).
   *
   * Load-bearing for precision, not just for the message: the detector matches
   * a provider's package *and its subpaths*, so without this the rule would
   * flag the very import that fixes the finding. Set it and that exact source
   * is never reported.
   */
  movedTo?: string;
}

/**
 * A method path off a client instance that no longer exists in some version of
 * a provider's SDK — `supabase.auth.signIn(...)`, `client.metrics.query(...)`.
 *
 * The same hand-verification standard as `SymbolRemoval`, against the same
 * evidence: two published tarballs, read as implementation. The difference is
 * only where the break shows up in the caller's code, which is why these are
 * matched against a *verified client receiver* rather than against an import.
 */
export interface MethodRemoval extends RemovalFacts {
  /**
   * Dotted method path off the client instance, exactly as written at the call
   * site: 'metrics.query', 'auth.signIn', 'createSession'.
   *
   * Matched against the trailing segments of a call whose receiver traces to
   * this provider's SDK — never against a bare name, which is what keeps a
   * project's own `auth.signIn()` helper from matching.
   */
  path: string;
}

/**
 * Hand-written SDK surface description. Method lists are verified against the
 * provider's published SDK/docs — never auto-derived from package exports,
 * which breaks on version bumps and picks up re-exported internals.
 */
export interface ProviderSurface {
  /** Package sources whose imports create clients (e.g. ['resend']). */
  packages: string[];
  /** Client constructor export names (e.g. ['Resend']). */
  clientConstructors: string[];
  /** Local-binding heuristic for wrapper imports (e.g. `import { resend } from '@/lib/resend'`). */
  clientNamePattern: RegExp;
  /** Full dotted method paths off a client instance (e.g. 'emails.send'). */
  methods: string[];
  /** Docs page the method list was verified against. */
  docsUrl: string;
  /**
   * Last hand-verification of this surface against the SDK's own source.
   *
   * The manifest — not npm — is the source of truth for what this repo
   * supports. `commit` pins the exact SDK revision a human read, which is what
   * makes `check:surface --local` able to diff SDK *source* forward from here:
   * a method-name diff only ever shows added/removed symbols, while most
   * breaking changes are logic changes behind an unchanged signature.
   */
  verified?: SurfaceVerification;
}

/** A point-in-time hand-verification of a surface against the SDK's source. */
export interface SurfaceVerification {
  /** SDK version verified against (semver, no leading `v`). */
  version: string;
  /** Full commit SHA in the SDK's own repository at that version. */
  commit: string;
  /** ISO date (YYYY-MM-DD) the verification was performed. */
  at: string;
  /**
   * Path within the SDK repo holding the client source, relative to its git
   * root — the scope `check:surface --local` diffs forward from `commit`.
   */
  sourceDir: string;
}

/**
 * SDK surface a codebase actually calls for one provider. Deliberately carries
 * no available/unused lists and no counts or ratios — using a small part of an
 * API is a fit, not a gap.
 */
export interface ProviderCoverage {
  provider: string;
  /** Sorted dotted method paths actually called (e.g. ['batch.send', 'emails.send']). */
  used: string[];
}

/**
 * Internal collection result: ProviderCoverage plus diagnostics that are
 * stripped from the report (the report carries no counts by design) but sent
 * to telemetry, where undercounting must stay visible.
 */
export interface CoverageCollection extends ProviderCoverage {
  /**
   * Calls made on a verified SDK client that we could not match to a method
   * in the surface manifest — the SDK grew a method we haven't listed yet, or
   * the code uses a low-level escape hatch (`resend.post(...)`). A count
   * only; the method names stay on the machine.
   */
  unknownSdkCalls: number;
}

export type DetectionSource = 'package.json' | 'imports' | 'url-patterns';

export interface DetectedProvider {
  name: string;
  source: DetectionSource;
  /** True when api-doctor ran at least one rule for this provider. */
  checked: boolean;
  /**
   * Scan-relative paths of source files that reference this provider's SDK
   * (import/require statements or API URL substrings). Empty when detection
   * came from package.json alone and no source file uses the SDK yet.
   */
  files?: string[];
}

/**
 * Structured report written to disk and emitted via `--format`. Schema is
 * versioned independently of the package so downstream consumers can pin to it.
 */
export interface Report {
  /**
   * Discriminator against `MigrationReport`, which carries `kind: 'migration'`.
   *
   * There are two report shapes on disk now and an agent may be handed either
   * one, so each says what it is rather than relying on its filename or on the
   * reader having a current SKILL.md. Added in schema 1.2.0.
   */
  kind: 'scan';
  schemaVersion: '1.2.0';
  tool: { name: 'api-doctor'; version: string };
  scanMeta: ScanMeta;
  summary: ReportSummary;
  findings: Finding[];
  /** Informational SDK usage per provider. Omitted entirely when no detected provider qualifies. */
  coverage?: ProviderCoverage[];
}

export interface ScanMeta {
  /** Absolute path scanned. */
  directory: string;
  /** ISO 8601 timestamp. */
  scannedAt: string;
  durationMs: number;
  filesScanned: number;
  /** Languages present in the scanned tree. */
  languagesScanned?: RuleLanguage[];
  providersDetected: Array<{
    name: string;
    detectedVia: DetectedProvider['source'];
    rulesRun: number;
  }>;
}

export interface ReportSummary {
  score: number;
  severity: ReportSeverityLabel;
  errors: number;
  warnings: number;
  info: number;
  totalIssues: number;
}

export interface Finding {
  /** `<rule-key>-<sequential-number>`; stable across runs as long as code is unchanged. */
  id: string;
  rule: string;
  category: FindingCategory;
  severity: Severity;
  message: string;
  fix: string;
  /**
   * Compatibility findings only: what to check before trusting the rewrite.
   * Its own key on purpose — `fix` says what to change, this says what could
   * still differ afterwards, and folding the two would lose that distinction.
   */
  verifyHint?: string;
  docsUrl?: string;
  cwe?: string;
  owasp?: string;
  location: {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
  };
  codeSnippet: CodeSnippet;
}

export interface CodeSnippet {
  lines: Array<{ number: number; text: string }>;
  highlightedLine: number;
}

/** Order used when sorting findings (errors first). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * The 0–100 score. Info findings are advisory and never affect it.
 *
 * The single definition — the report and the terminal header must never be
 * able to disagree about the headline number.
 */
export function computeScore(errors: number, warnings: number): number {
  return Math.max(0, 100 - errors * 15 - warnings * 5);
}

/** Maps a 0–100 score to the structured report's severity label. */
export function scoreToSeverityLabel(score: number): ReportSeverityLabel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'needs-work';
  return 'critical';
}
export interface ProviderAnchor {
  /** Provider name — must equal the manifest name and the rule-key prefix. */
  provider: string;
  /**
   * Import/require sources counting as direct SDK evidence. An entry matches
   * the exact source or any subpath of it (`firebase` matches `firebase/auth`);
   * entries ending in `/` are pure prefixes (`@s2-dev/`).
   */
  packages: string[];
  /** Client class / factory export names: `new X(...)` or `X(...)` yields a client. */
  clientConstructors: string[];
  /** The SDK's default export is itself a client factory (`import twilio from 'twilio'`). */
  defaultIsFactory?: boolean;
  /** Local binding names that look like this provider's client (wrapper-import fallback). */
  clientNamePattern?: RegExp;
  /** Non-SDK import sources that look like a wrapper module for this provider. */
  wrapperSourcePattern?: RegExp;
  /** Provider-distinctive URL substrings in string/template literals. */
  urlSubstrings: string[];
  /** Provider-distinctive tokens in literals (webhook headers, env vars, event types…). */
  tokenPattern?: RegExp;
  /**
   * Provider-distinctive identifier names (property keys, member accesses,
   * class fields) counting as file evidence. For protocol-level integrations
   * that never import the SDK or write a distinctive string — e.g. a Twilio
   * Media Streams handler whose only tell is the `streamSid` field it reads
   * and writes. Matched against the whole name, so keep entries anchored
   * (`/^streamSid$/i`), never substrings.
   */
  identifierPattern?: RegExp;
}

/**
 * A requested SDK upgrade: "take this project's <provider> from what it has
 * installed to <target>".
 *
 * Migration is the mirror image of the compatibility category, and the two must
 * never be confused. A compatibility finding says *this call is broken right
 * now* against what is in node_modules. A migration entry says *this call would
 * have to change if you moved forward*, and it only exists because the user
 * asked for it by name on the command line. Nothing about an upgrade is ever
 * volunteered: a plain scan resolves no target and every rule keeps its
 * original, backward-looking gate.
 *
 * Held in one shape so the CLI (which parses it), the engine (which forwards
 * it) and the plugin (which reads it back out of the environment) all agree on
 * what a target is.
 */
export interface MigrationTarget {
  /** Provider name as the manifests spell it — 'supabase', not '@supabase/supabase-js'. */
  provider: string;
  /**
   * The UPPER BOUND of the requested move, as a full semver triple so
   * `compareSemver` can use it.
   *
   * A partial version is padded UP, not down: `supabase@2` means "the 2.x
   * line", so it becomes `2.<max>.<max>` and reaches every removal anywhere in
   * that line. Padding down to `2.0.0` was wrong and silently so — it produced
   * an empty plan for every provider whose breaking change did not land in
   * `x.0.0`, which is most of them. Tiptap removes at 3.0.1, s2 at 0.24.0,
   * agentmail at 0.5.12; all three would have reported nothing to do.
   *
   * Never render this. It is a comparison bound and reads as a real version
   * number without being one — `label` is what a human sees.
   */
  target: string;
  /** The move as a person would say it: '2.x', '2.4.x', '2.0.0'. */
  label: string;
  /** What the user typed, for messages that should echo it back. */
  raw: string;
}

/**
 * How much judgement a single change needs, derived from the removal's own
 * hand-verified `kind` and `wireIdentical` — never assigned per entry, so a
 * provider cannot quietly grade its own migration as easier than it is.
 *
 * The order is the order the work should be done in, and it is the order the
 * report emits: clear the safe bulk first so the diff for the hard changes is
 * small and readable.
 */
export type MigrationDifficulty =
  /** Same call, new name, verified identical on the wire. Safe to apply in bulk. */
  | 'mechanical'
  /** Name maps one-to-one, but behaviour does not. Each site needs reading. */
  | 'behavior-check'
  /** One entry point became several; only the arguments at the call site decide. */
  | 'argument-dependent'
  /** Same capability, different contract — sync to async, new return shape. */
  | 'restructure'
  /** Gone with no successor. A person has to decide what replaces it. */
  | 'decision-required';

/** One call site that has to change, with enough context to find and read it. */
export interface MigrationSite {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  /** Source lines around the call, same shape the scan report's findings use. */
  codeSnippet?: CodeSnippet;
}

/**
 * Every call site of one removed symbol or method path, with the verified facts
 * about what it becomes.
 *
 * Sites are grouped under the change rather than listed flat because the unit
 * of work is the change: an agent decides once how `auth.session()` is rewritten
 * and then applies that decision at eleven places, and a flat list invites it
 * to re-derive the answer eleven times.
 */
export interface MigrationChange {
  /** Stable id: `<provider>-<from>`. */
  id: string;
  /** Symbol or dotted method path as written today. */
  from: string;
  /** The single successor, when the removal has exactly one. */
  to?: string;
  /** Successors when the entry point was split; the caller picks by arguments. */
  toOptions?: string[];
  /** Module the symbol moved to, when that is the whole change. */
  movedTo?: string;
  kind: RemovalFacts['kind'];
  difficulty: MigrationDifficulty;
  /** First version without it — always ≤ the migration target. */
  removedIn: string;
  wireIdentical: boolean;
  /** The hand-written `verifyHint`: what to check before trusting the rewrite. */
  verify: string;
  docsUrl?: string;
  sites: MigrationSite[];
}

/** Changes of one difficulty, with the instruction that applies to all of them. */
export interface MigrationGroup {
  difficulty: MigrationDifficulty;
  title: string;
  /** What to do with every change in this group, written for whoever executes it. */
  guidance: string;
  changes: MigrationChange[];
}

/**
 * The migration plan written to `.api-doctor/migration-<provider>.json`.
 *
 * Deliberately self-describing. `src/skill.ts` never overwrites a SKILL.md that
 * already exists, so a project installed before this feature shipped has a skill
 * that has never heard of a migration report and will never be updated by a
 * scan. An agent must therefore be able to pick this file up cold and know what
 * it is: `kind` says which of the two report shapes it is holding, and
 * `instructions` says what to do with it. Nothing here may depend on the reader
 * having a current skill.
 */
export interface MigrationReport {
  /** Discriminator against the scan report, which carries `kind: 'scan'`. */
  kind: 'migration';
  schemaVersion: '1.0.0';
  tool: { name: 'api-doctor'; version: string };
  provider: string;
  /** npm package the versions below refer to. */
  package: string;
  /** Version resolved from the project right now. */
  from: string;
  /** Version the user asked to move to, in human form: '2.x', '3.0.1'. */
  to: string;
  /**
   * Highest `removedIn` across every change in this plan — the exact version at
   * which the plan is provably finished, and the only thing `pruneCompletedPlans`
   * may compare against.
   *
   * `to` cannot serve: it is a human label ('2.x') and not always a version.
   * Absent when the plan has no changes, which is its own kind of finished.
   */
  completedAt?: string;
  /** Scanned directory, so a stale plan cannot be read against another project. */
  directory: string;
  generatedAt: string;
  /** Provider's own upgrade guide. */
  docsUrl?: string;
  /** How to use this file, for a reader with no api-doctor skill installed. */
  instructions: string[];
  summary: {
    /** Distinct symbols/method paths that must change. */
    changes: number;
    /** Individual call sites across those changes. */
    sites: number;
    byDifficulty: Partial<Record<MigrationDifficulty, number>>;
  };
  groups: MigrationGroup[];
}
