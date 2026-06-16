/**
 * Shared contracts for provider detection, oxlint rule mapping, and scan output.
 */

export type Severity = 'error' | 'warning' | 'info';

export type FindingCategory = 'security' | 'correctness' | 'reliability' | 'integration';

export type ReportSeverityLabel = 'excellent' | 'good' | 'needs-work' | 'critical';

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

/** Maps a provider to the oxlint rules that should run when it is detected. */
export interface OxlintRuleMeta {
  /** Rule key registered in the plugin (e.g. `resend-webhook-signature`). */
  key: string;
  /** Human-readable rule id shown in reports (e.g. `resend/webhook-signature-missing`). */
  resultRule: string;
  message: string;
  fix: string;
  docsUrl?: string;
  severity?: Severity;
}

export interface ProviderManifest {
  name: string;
  displayName: string;
  detect: {
    packages?: string[];
    imports?: string[];
    urlPatterns?: string[];
  };
  oxlintRules: OxlintRuleMeta[];
}

export interface DetectedProvider {
  name: string;
  source: 'package.json' | 'imports' | 'url-patterns';
  /** True when api-doctor ran oxlint rules for this provider. */
  checked: boolean;
}

/**
 * Structured report written to disk and emitted via `--format`. Schema is
 * versioned independently of the package so downstream consumers can pin to it.
 */
export interface Report {
  schemaVersion: '1.0.0';
  tool: { name: 'api-doctor'; version: string };
  scanMeta: ScanMeta;
  summary: ReportSummary;
  findings: Finding[];
}

export interface ScanMeta {
  /** Absolute path scanned. */
  directory: string;
  /** ISO 8601 timestamp. */
  scannedAt: string;
  durationMs: number;
  filesScanned: number;
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
