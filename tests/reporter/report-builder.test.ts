import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/reporter/report-builder.js';
import type { DetectedProvider, ScanResult } from '../../src/types.js';

const detected: DetectedProvider[] = [{ name: 'resend', source: 'imports', checked: true }];

function result(partial: Partial<ScanResult>): ScanResult {
  return {
    file: 'a.ts',
    line: 1,
    column: 1,
    snippet: '',
    ruleKey: 'resend-missing-idempotency-key',
    rule: 'resend/reliability/missing-idempotency-key',
    severity: 'warning',
    message: 'm',
    fix: 'f',
    ...partial,
  };
}

function build(results: ScanResult[]) {
  return buildReport({
    results,
    detected,
    directory: '/tmp/project',
    filesScanned: 3,
    filesContent: new Map(),
    durationMs: 12.4,
    version: '9.9.9',
  });
}

describe('buildReport', () => {
  it('sorts findings by severity, then file, then line', () => {
    const report = build([
      result({ severity: 'info', ruleKey: 'resend-missing-tags', file: 'a.ts', line: 5 }),
      result({ severity: 'error', ruleKey: 'resend-api-key-hardcoded', file: 'z.ts', line: 2 }),
      result({ severity: 'warning', file: 'b.ts', line: 9 }),
      result({ severity: 'warning', file: 'a.ts', line: 3 }),
    ]);
    expect(report.findings.map((f) => [f.severity, f.location.file, f.location.line])).toEqual([
      ['error', 'z.ts', 2],
      ['warning', 'a.ts', 3],
      ['warning', 'b.ts', 9],
      ['info', 'a.ts', 5],
    ]);
  });

  it('assigns sequential ids per rule key in sort order', () => {
    const report = build([
      result({ file: 'b.ts', line: 2 }),
      result({ file: 'a.ts', line: 1 }),
    ]);
    expect(report.findings.map((f) => f.id)).toEqual([
      'resend-missing-idempotency-key-1',
      'resend-missing-idempotency-key-2',
    ]);
  });

  it('computes score and severity label (info does not penalize)', () => {
    const report = build([
      result({ severity: 'error', ruleKey: 'resend-api-key-hardcoded' }),
      result({ severity: 'warning' }),
      result({ severity: 'info', ruleKey: 'resend-missing-tags' }),
    ]);
    // 100 - 15 - 5 = 80 -> excellent
    expect(report.summary.score).toBe(80);
    expect(report.summary.severity).toBe('excellent');
    expect(report.summary).toMatchObject({ errors: 1, warnings: 1, info: 1, totalIssues: 3 });
  });

  it('carries CWE/OWASP from the rule registry for security rules', () => {
    const report = build([result({ ruleKey: 'resend-api-key-hardcoded', severity: 'error' })]);
    expect(report.findings[0].category).toBe('security');
    expect(report.findings[0].cwe).toBe('CWE-798');
    expect(report.findings[0].owasp).toContain('API8:2023');
  });

  it('embeds tool version and scan metadata', () => {
    const report = build([result({})]);
    expect(report.tool.version).toBe('9.9.9');
    expect(report.scanMeta.filesScanned).toBe(3);
    expect(report.scanMeta.durationMs).toBe(12);
    expect(report.scanMeta.providersDetected[0]).toEqual({
      name: 'resend',
      detectedVia: 'imports',
      // Tracks the number of enabled rules in the resend manifest.
      // RULE-DISABLED 2026-07-28: 13 -> 12 when resend-api-key-hardcoded was
      // commented out pre-launch; restore to 14 when it is re-enabled.
      // 12 -> 13 on 2026-08-05: resend-unchecked-send-error added.
      rulesRun: 13,
    });
  });
});
