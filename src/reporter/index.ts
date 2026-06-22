/**
 * Output orchestration. Picks the renderer based on CLI flags and writes the
 * structured report file. The default (no-flag) path renders the stable human
 * terminal output unchanged.
 */
import type { DetectedProvider, Report, ScanResult } from '../types.js';
import { ScanError } from '../scanner.js';
import { INSTALL_COMMAND, isAgentSkillInstalled } from '../install.js';
import { writeReport } from './json-writer.js';
import { renderMarkdown } from './markdown.js';
import { countErrors, renderInstallHint, renderTerminalReport } from './terminal.js';
import { renderVerboseReport } from './verbose.js';

export type OutputFormat = 'json' | 'markdown' | 'sarif';

export interface EmitOptions {
  quiet?: boolean;
  verbose?: boolean;
  format?: OutputFormat;
  noReport?: boolean;
  /** Absolute path the report file is written to. */
  outputPath: string;
  /** Path shown to the user (relative when possible). */
  reportDisplayPath: string;
  elapsedMs?: number;
}

export { countErrors };

export async function emitReport(
  results: ScanResult[],
  detected: DetectedProvider[],
  report: Report,
  options: EmitOptions,
): Promise<void> {
  const writeFileReport = (): void => {
    if (!options.noReport) writeReport(report, options.outputPath);
  };

  // Structured stdout formats suppress all human output so the stream can be piped.
  if (options.format) {
    if (options.format === 'json') {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (options.format === 'markdown') {
      process.stdout.write(renderMarkdown(report));
    } else if (options.format === 'sarif') {
      throw new ScanError('SARIF output is not implemented yet');
    } else {
      throw new ScanError(`Unsupported format: ${options.format}`);
    }
    writeFileReport();
    return;
  }

  if (options.quiet) {
    writeFileReport();
    const parts = [`Score: ${report.summary.score}/100`];
    if (!options.noReport) parts.push(`→ ${options.reportDisplayPath}`);
    console.log(parts.join('  '));
    return;
  }

  if (options.verbose) {
    await renderVerboseReport(report);
  } else {
    await renderTerminalReport(results, detected, { elapsedMs: options.elapsedMs });
  }

  writeFileReport();
  if (!options.noReport) {
    console.log(`→ Report written to ${options.reportDisplayPath}`);
  }

  if (!isAgentSkillInstalled(report.scanMeta.directory)) {
    renderInstallHint();
  }
}
