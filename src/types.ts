/**
 * Shared contracts for provider detection, rule mapping, coverage, and scan output.
 */

export type Severity = 'error' | 'warning' | 'info';

export type FindingCategory = 'security' | 'correctness' | 'reliability';

export type ReportSeverityLabel = 'excellent' | 'good' | 'needs-work' | 'critical';

/** Languages api-doctor can analyze. */
export type RuleLanguage = 'javascript' | 'python';

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
    /** PyPI package names in requirements.txt / pyproject.toml */
    pythonPackages?: string[];
    /** JS/TS import/require module strings */
    imports?: string[];
    /** Python import module names (e.g. `resend`) */
    pythonImports?: string[];
    urlPatterns?: string[];
  };
  rules: RuleMeta[];
  /** SDK surface description driving coverage collection. Optional — coverage is skipped for providers without one. */
  surface?: ProviderSurface;
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

export type DetectionSource =
  | 'package.json'
  | 'imports'
  | 'url-patterns'
  | 'pyproject'
  | 'requirements'
  | 'python-imports';

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
  schemaVersion: '1.1.0';
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
