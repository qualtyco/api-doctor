/**
 * CLI entry point: parses arguments with commander, runs the scan, emits output
 * in the requested mode, and exits with a CI-friendly status code.
 *
 * Exit codes (ESLint convention):
 *   0 — no errors, and warnings within the --max-warnings threshold
 *   1 — errors found, or warnings exceeded --max-warnings
 *   2 — tool-level failure (unreadable directory, oxlint crash, bad flag)
 */
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAgentFiles } from './install.js';
import { providers } from './providers/index.js';
import { createSpinner } from './reporter/animate.js';
import {
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_FILE,
} from './reporter/json-writer.js';
import { buildReport } from './reporter/report-builder.js';
import { countErrors, emitReport, type OutputFormat } from './reporter/index.js';
import { scan, ScanError } from './scanner.js';
import { trackError, trackInstall, trackRun } from './telemetry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
) as { version: string };

const VALID_FORMATS: OutputFormat[] = ['json', 'markdown'];

interface CliOptions {
  quiet?: boolean;
  verbose?: boolean;
  format?: string;
  output?: string;
  /** commander sets this to false when --no-report is passed. */
  report?: boolean;
  maxWarnings?: string;
  provider?: string;
  listProviders?: boolean;
  /** commander sets this to false when --no-telemetry is passed. */
  telemetry?: boolean;
}

function fail(message: string): never {
  console.error(`api-doctor: ${message}`);
  process.exit(2);
}

const program = new Command();

program
  .name('api-doctor')
  .description('Verification rules for AI-generated API integrations')
  .version(pkg.version)
  .argument('[directory]', 'Project directory to scan', '.')
  .option('--quiet', 'Print only the score and report path')
  .option('--verbose', 'Print every finding inline with code snippets')
  .option('--format <format>', 'Emit structured output to stdout (json|markdown)')
  .option('--output <path>', `Report file location (default: ${DEFAULT_REPORT_DIR}/${DEFAULT_REPORT_FILE})`)
  .option('--no-report', 'Do not write the report file')
  .option('--max-warnings <n>', 'Exit with code 1 if warnings exceed this number')
  .option('--provider <names>', 'Comma-separated providers to scan (e.g. resend)')
  .option('--list-providers', 'List supported Node.js API providers')
  .option('--no-telemetry', 'Disable anonymous usage telemetry')
  .action(async (directory: string, opts: CliOptions) => {
    const noTelemetry = opts.telemetry === false;

    if (opts.listProviders) {
      for (const p of providers) {
        console.log(`${p.name} — ${p.displayName}`);
      }
      process.exit(0);
    }

    let format: OutputFormat | undefined;
    if (opts.format) {
      if (!VALID_FORMATS.includes(opts.format as OutputFormat)) {
        fail(`unknown --format "${opts.format}" (expected json or markdown)`);
      }
      format = opts.format as OutputFormat;
    }

    let maxWarnings: number | undefined;
    if (opts.maxWarnings !== undefined) {
      maxWarnings = Number(opts.maxWarnings);
      if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
        fail(`--max-warnings expects a non-negative integer, got "${opts.maxWarnings}"`);
      }
    }

    const onlyProviders = opts.provider
      ? opts.provider.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const start = performance.now();

    try {
      const spinner = createSpinner('Scanning for API integrations…');
      let scanOutput;
      try {
        scanOutput = await scan(directory, { onlyProviders });
      } finally {
        spinner.stop();
      }
      const { results, detected, rawPackages, directory: scannedDir, filesScanned, filesContent } = scanOutput;
      const elapsedMs = performance.now() - start;

      const report = buildReport({
        results,
        detected,
        directory: scannedDir,
        filesScanned,
        filesContent,
        durationMs: elapsedMs,
        version: pkg.version,
      });

      const outputPath = opts.output
        ? resolve(opts.output)
        : join(scannedDir, DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILE);
      const rel = relative(scannedDir, outputPath);
      const reportDisplayPath = rel.startsWith('..') ? outputPath : rel;

      await emitReport(results, detected, report, {
        quiet: opts.quiet,
        verbose: opts.verbose,
        format,
        noReport: opts.report === false,
        outputPath,
        reportDisplayPath,
        elapsedMs,
        rawPackages,
      });

      const errors = countErrors(results);
      const warningsExceeded =
        maxWarnings !== undefined && report.summary.warnings > maxWarnings;

      await trackRun({
        version: pkg.version,
        results,
        detected,
        score: report.summary.score,
        durationMs: elapsedMs,
        noTelemetry,
        projectDir: scannedDir,
      });

      process.exit(errors > 0 || warningsExceeded ? 1 : 0);
    } catch (err) {
      if (err instanceof ScanError) {
        await trackError(err, noTelemetry, pkg.version);
        fail(err.message);
      }
      await trackError(err, noTelemetry, pkg.version);
      throw err;
    }
  });

program
  .command('install')
  .description('Install api-doctor as a skill/rule for Claude Code, Cursor, Codex, and other agents')
  .argument('[directory]', 'Project directory to install into', '.')
  .option('--force', 'Overwrite an existing skills/api-doctor/SKILL.md from the package')
  .option('--no-telemetry', 'Disable anonymous usage telemetry')
  .action(async (directory: string, options: { force?: boolean; telemetry?: boolean }) => {
    const noTelemetry = options.telemetry === false;
    const { created, updated, skipped } = installAgentFiles(resolve(directory), {
      force: options.force,
    });
    for (const path of created) console.log(`api-doctor: created ${path}`);
    for (const path of updated) console.log(`api-doctor: updated ${path}`);
    for (const path of skipped) {
      console.log(`api-doctor: skipped ${path} (already exists; use --force to refresh)`);
    }
    console.log(
      'api-doctor: edit skills/api-doctor/SKILL.md — all agents reference that file.',
    );
    await trackInstall({
      version: pkg.version,
      filesCreated: created.length,
      filesUpdated: updated.length,
      filesSkipped: skipped.length,
      force: options.force ?? false,
      noTelemetry,
    });
  });

program.parse();
