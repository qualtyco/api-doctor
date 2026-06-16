/**
 * Unaggregated terminal output: every finding printed inline with a code
 * snippet, in the report's sort order. Used by `--verbose`.
 */
import pc from 'picocolors';
import type { Report, Severity } from '../types.js';

function severityTag(severity: Severity): string {
  if (severity === 'error') return pc.red('error');
  if (severity === 'warning') return pc.yellow('warning');
  return pc.cyan('info');
}

function printSnippet(report: Report, index: number): void {
  const finding = report.findings[index];
  const { lines, highlightedLine } = finding.codeSnippet;
  const gutterWidth = String(lines.at(-1)?.number ?? highlightedLine).length;
  for (const line of lines) {
    const num = String(line.number).padStart(gutterWidth, ' ');
    const isIssue = line.number === highlightedLine;
    const marker = isIssue ? pc.red('>') : ' ';
    const body = `${marker} ${pc.dim(`${num} |`)} ${line.text}`;
    console.log(isIssue ? body : pc.dim(body));
  }
}

export function renderVerboseReport(report: Report): void {
  const { summary, findings } = report;
  console.log('');
  console.log(
    pc.bold(`api-doctor — ${summary.score}/100 (${summary.severity})`),
  );
  console.log(
    pc.dim(
      `${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info across ${report.scanMeta.filesScanned} files`,
    ),
  );
  console.log('');

  if (findings.length === 0) {
    console.log(pc.green(`${pc.bold('✓')} No issues found`));
    return;
  }

  findings.forEach((finding, index) => {
    const loc = `${finding.location.file}:${finding.location.line}:${finding.location.column}`;
    console.log(
      `${severityTag(finding.severity)} ${pc.bold(finding.message)} ${pc.dim(`[${finding.rule}]`)}`,
    );
    console.log(pc.dim(`  ${loc}`));
    console.log('');
    printSnippet(report, index);
    console.log('');
    console.log(`  ${pc.cyan('Fix:')} ${finding.fix}`);
    if (finding.docsUrl) console.log(`  ${pc.dim('Docs:')} ${finding.docsUrl}`);
    console.log('');
  });
}
