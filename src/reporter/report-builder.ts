/**
 * Turns raw scan output into the versioned Report consumed by the JSON and
 * markdown writers. Owns score computation, finding sort order, and stable finding ids.
 */
import { getRuleDocsMeta } from '../plugin/rule-registry.js';
import { providers } from '../providers/index.js';
import { extractCodeSnippet } from './snippet.js';
import {
  SEVERITY_ORDER,
  ruleLanguages,
  computeScore,
  scoreToSeverityLabel,
  type DetectedProvider,
  type Finding,
  type ProviderCoverage,
  type Report,
  type ReportSummary,
  type RuleLanguage,
  type ScanResult,
} from '../types.js';

export interface BuildReportInput {
  results: ScanResult[];
  detected: DetectedProvider[];
  directory: string;
  filesScanned: number;
  filesContent: Map<string, string>;
  durationMs: number;
  version: string;
  scannedAt?: Date;
  /** Informational SDK usage; never affects summary or findings. */
  coverage?: ProviderCoverage[];
  languagesScanned?: RuleLanguage[];
}

function buildSummary(results: ScanResult[]): ReportSummary {
  const errors = results.filter((r) => r.severity === 'error').length;
  const warnings = results.filter((r) => r.severity === 'warning').length;
  const info = results.filter((r) => r.severity === 'info').length;
  const score = computeScore(errors, warnings);
  return {
    score,
    severity: scoreToSeverityLabel(score),
    errors,
    warnings,
    info,
    totalIssues: results.length,
  };
}

/** Errors first, then by file path, then by line — determines fix order. */
function sortResults(results: ScanResult[]): ScanResult[] {
  return [...results].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byFile = a.file.localeCompare(b.file);
    if (byFile !== 0) return byFile;
    return a.line - b.line;
  });
}

function toFinding(result: ScanResult, sequence: number, content: string): Finding {
  const docs = getRuleDocsMeta(result.ruleKey);
  return {
    id: `${result.ruleKey}-${sequence}`,
    rule: result.rule,
    category: docs?.category ?? 'correctness',
    severity: result.severity,
    message: result.message,
    fix: result.fix,
    // Own key, never folded into `fix` — absent entirely on rules that have no
    // verified hint, so a reader can tell "nothing to check" from "unchecked".
    ...(result.verifyHint ? { verifyHint: result.verifyHint } : {}),
    docsUrl: result.docsUrl ?? docs?.docsUrl,
    cwe: docs?.cwe,
    owasp: docs?.owasp,
    location: {
      file: result.file,
      line: result.line,
      column: result.column,
      endLine: result.endLine,
      endColumn: result.endColumn,
    },
    codeSnippet: extractCodeSnippet(content, result.line),
  };
}

export function buildReport(input: BuildReportInput): Report {
  const sorted = sortResults(input.results);
  const summary = buildSummary(input.results);

  // Per-rule sequential numbering, assigned in the global sort order.
  const counters = new Map<string, number>();
  const findings: Finding[] = sorted.map((result) => {
    const next = (counters.get(result.ruleKey) ?? 0) + 1;
    counters.set(result.ruleKey, next);
    const content = input.filesContent.get(result.file) ?? '';
    return toFinding(result, next, content);
  });

  // When languagesScanned is omitted (unit tests / older callers), count every
  // rule. Otherwise only count rules that apply to languages present in the scan.
  const langs = input.languagesScanned?.length
    ? new Set(input.languagesScanned)
    : null;
  const providersDetected = input.detected.map((d) => {
    const manifest = providers.find((p) => p.name === d.name);
    let rulesRun = 0;
    if (d.checked && manifest) {
      rulesRun = new Set(
        manifest.rules
          .filter((rule) => {
            if (!langs) return true;
            return langs.has('javascript') && ruleLanguages(rule).includes('javascript');
          })
          .map((r) => r.key),
      ).size;
    }
    return {
      name: d.name,
      detectedVia: d.source,
      rulesRun,
    };
  });

  const coverageForReport = (input.coverage ?? [])
    .filter((entry) => entry.used.length > 0)
    .map(({ provider, used }) => ({ provider, used }));

  return {
    schemaVersion: '1.1.0',
    tool: { name: 'api-doctor', version: input.version },
    scanMeta: {
      directory: input.directory,
      scannedAt: (input.scannedAt ?? new Date()).toISOString(),
      durationMs: Math.round(input.durationMs),
      filesScanned: input.filesScanned,
      languagesScanned: input.languagesScanned,
      providersDetected,
    },
    summary,
    findings,
    // Omitted entirely (not []) when no provider has verified usage to show.
    // A provider that was collected but resolved no calls carries nothing for
    // a reader, so it is dropped here rather than rendered as an empty
    // section; the collection entry still reaches telemetry, where "scanned,
    // found nothing" is a distinct and meaningful signal. Collection
    // diagnostics (unknownSdkCalls) are telemetry-only — the report carries
    // no counts by design.
    ...(coverageForReport.length ? { coverage: coverageForReport } : {}),
  };
}
