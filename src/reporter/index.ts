/**
 * Output orchestration. Picks the renderer based on CLI flags and writes the
 * structured report file. The default (no-flag) path renders the stable human
 * terminal output unchanged.
 */
import type { ProviderVersion } from '../sdk-versions.js';
import type { DetectedProvider, Report, ScanResult } from '../types.js';
import { ScanError } from '../scan-error.js';
import { writeReport } from './json-writer.js';
import { renderMarkdown } from './markdown.js';
import { writeStdout } from './stdout.js';
import { countErrors, renderFooter, renderTerminalReport, renderUnsupportedPackagesHint } from './terminal.js';
import { renderVerboseReport } from './verbose.js';
import { getUnsupportedPackages } from '../unsupported-packages.js';

export type OutputFormat = 'json' | 'markdown';

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
  /** Installed SDK version per provider, keyed by provider name. */
  versions?: Map<string, ProviderVersion>;
  /** Score from the previous run on this project, for the delta line. */
  previousScore?: number;
  /**
   * Skill files written by this run. Empty on every later run — the notice is
   * news exactly once.
   */
  skillPaths?: string[];
}

export { countErrors };

export async function emitReport(
  results: ScanResult[],
  detected: DetectedProvider[],
  report: Report,
  options: EmitOptions & { rawPackages?: string[] },
): Promise<void> {
  const writeFileReport = (): void => {
    if (!options.noReport) writeReport(report, options.outputPath);
  };

  // Structured stdout formats suppress all human output so the stream can be piped.
  if (options.format) {
    // Awaited: the caller exits the process straight after this returns, and
    // an unflushed pipe write would be thrown away. See reporter/stdout.ts.
    if (options.format === 'json') {
      await writeStdout(`${JSON.stringify(report, null, 2)}\n`);
    } else if (options.format === 'markdown') {
      await writeStdout(renderMarkdown(report));
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
    await renderTerminalReport(results, detected, {
      elapsedMs: options.elapsedMs,
      reportDisplayPath: options.noReport ? undefined : options.reportDisplayPath,
      coverage: report.coverage,
      versions: options.versions,
      previousScore: options.previousScore,
    });
  }

  writeFileReport();

  if (!options.format && !options.quiet && getUnsupportedPackages(options.rawPackages ?? []).length > 0) {
    renderUnsupportedPackagesHint();
  }

  if (detected.length > 0) {
    renderFooter({
      reportPath: options.noReport ? undefined : options.reportDisplayPath,
      skillPaths: options.skillPaths,
    });
  } else if (!options.noReport) {
    console.log(`→ Report written to ${options.reportDisplayPath}`);
  }
}
