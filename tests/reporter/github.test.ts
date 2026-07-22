import { describe, expect, it } from 'vitest';
import { renderGitHubAnnotations } from '../../src/reporter/github.js';
import { buildReport } from '../../src/reporter/report-builder.js';
import type { DetectedProvider, ScanResult } from '../../src/types.js';

const detected: DetectedProvider[] = [{ name: 'resend', source: 'imports', checked: true }];

function result(partial: Partial<ScanResult>): ScanResult {
  return {
    file: 'src/email.ts',
    line: 4,
    column: 7,
    snippet: '',
    ruleKey: 'resend-api-key-hardcoded',
    rule: 'resend/security/api-key-hardcoded',
    severity: 'error',
    message: 'Hardcoded Resend API key',
    fix: 'Move the key to process.env.RESEND_API_KEY.',
    docsUrl: 'https://resend.com/docs/api-reference/introduction',
    ...partial,
  };
}

function build(results: ScanResult[], directory = '/repo') {
  return buildReport({
    results,
    detected,
    directory,
    filesScanned: 1,
    filesContent: new Map(),
    durationMs: 5,
    version: '9.9.9',
  });
}

describe('renderGitHubAnnotations', () => {
  it('emits one workflow command per finding with location properties', () => {
    const report = build([result({ endLine: 4, endColumn: 40 })]);
    const out = renderGitHubAnnotations(report, '/repo');
    expect(out).toBe(
      '::error file=src/email.ts,line=4,col=7,endLine=4,endColumn=40,' +
        'title=api-doctor%3A resend/security/api-key-hardcoded::' +
        'Hardcoded Resend API key Fix: Move the key to process.env.RESEND_API_KEY. ' +
        'Docs: https://resend.com/docs/api-reference/introduction\n',
    );
  });

  it('maps severities to error, warning, and notice commands', () => {
    const report = build([
      result({}),
      result({
        severity: 'warning',
        ruleKey: 'resend-missing-idempotency-key',
        rule: 'resend/reliability/missing-idempotency-key',
      }),
      result({ severity: 'info', ruleKey: 'resend-missing-tags', rule: 'resend/reliability/missing-tags' }),
    ]);
    const commands = renderGitHubAnnotations(report, '/repo')
      .trim()
      .split('\n')
      .map((line) => line.slice(2, line.indexOf(' ')));
    expect(commands).toEqual(['error', 'warning', 'notice']);
  });

  it('escapes newlines and percent signs in messages and commas in properties', () => {
    const report = build([
      result({ file: 'src/a,b.ts', message: 'line one\nline two 100%' }),
    ]);
    const out = renderGitHubAnnotations(report, '/repo');
    expect(out).toContain('file=src/a%2Cb.ts');
    expect(out).toContain('line one%0Aline two 100%25');
  });

  it('prefixes paths when the scanned directory is below the working directory', () => {
    const report = build([result({})], '/repo/apps/web');
    const out = renderGitHubAnnotations(report, '/repo');
    expect(out).toContain('file=apps/web/src/email.ts');
  });

  it('leaves paths untouched when the scanned directory is outside the working directory', () => {
    const report = build([result({})], '/elsewhere/project');
    const out = renderGitHubAnnotations(report, '/repo');
    expect(out).toContain('file=src/email.ts');
  });

  it('renders nothing for a clean report', () => {
    expect(renderGitHubAnnotations(build([]), '/repo')).toBe('');
  });
});
