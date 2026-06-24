/**
 * Turns raw scan output into the versioned Report consumed by the JSON and
 * markdown writers. Owns score computation, finding sort order, and stable finding ids.
 */
import { getRuleDocsMeta } from '../plugin/rule-registry.js';
import { providers } from '../providers/index.js';
import { extractCodeSnippet } from './snippet.js';
import {
  SEVERITY_ORDER,
  scoreToSeverityLabel,
  type DetectedProvider,
  type Finding,
  type Report,
  type ReportSummary,
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
}

/** Same scoring as the terminal report: info findings do not affect the score. */
function computeScore(errors: number, warnings: number): number {
  return Math.max(0, 100 - errors * 15 - warnings * 5);
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

  const providersDetected = input.detected.map((d) => {
    const manifest = providers.find((p) => p.name === d.name);
    return {
      name: d.name,
      detectedVia: d.source,
      rulesRun: d.checked ? (manifest?.oxlintRules.length ?? 0) : 0,
    };
  });

  return {
    schemaVersion: '1.0.0',
    tool: { name: 'api-doctor', version: input.version },
    scanMeta: {
      directory: input.directory,
      scannedAt: (input.scannedAt ?? new Date()).toISOString(),
      durationMs: Math.round(input.durationMs),
      filesScanned: input.filesScanned,
      providersDetected,
    },
    summary,
    findings,
  };
}
