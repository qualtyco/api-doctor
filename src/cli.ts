/**
 * CLI entry point: parses arguments with commander, runs the scan, emits output
 * in the requested mode, optionally hands the errors to a coding agent the user
 * picks, and exits with a CI-friendly status code.
 *
 * Scanning and fixing are one command on purpose — `npx @api-doctor/cli .` is
 * the whole product surface, so the loop closes without the user having to know
 * a second incantation exists.
 *
 * Exit codes (ESLint convention):
 *   0 — no errors, and warnings within the --max-warnings threshold
 *   1 — errors found, or warnings exceeded --max-warnings
 *   2 — tool-level failure (unreadable directory, oxlint crash, bad flag)
 */
import { Command } from 'commander';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyToClipboard } from './clipboard.js';
import {
  agentById,
  buildAgentMenu,
  buildFixPrompt,
  defaultAgentIndex,
  defaultFixAgent,
  describeHandoff,
  describeMissingAgent,
  describeNothingToFix,
  describeRetrigger,
  describeSessionEnd,
  detectFixAgents,
  filterFixableFindings,
  FIX_AGENTS,
  isOnPath,
  launchAgent,
  resolveFixMode,
  type FixAgent,
  type FixMode,
} from './fix.js';
import { canPrompt, selectFromList } from './select.js';
import { installAgentFiles } from './install.js';
import { providers } from './providers/index.js';
import { createSpinner } from './reporter/animate.js';
import { DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILE } from './reporter/json-writer.js';
import { buildReport } from './reporter/report-builder.js';
import { countErrors, emitReport, type OutputFormat } from './reporter/index.js';
import { readProjectHistory } from './run-history.js';
import { scan, ScanError } from './scanner.js';
import { resolveProviderVersions } from './sdk-versions.js';
import { trackError, trackFix, trackInstall, trackRun } from './telemetry.js';
import type { Report } from './types.js';

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
  agentModel?: string;
  /**
   * Tri-state: `--fix` (optionally naming an agent) forces the handoff,
   * `--no-fix` suppresses the offer, and undefined means ask when there is a
   * terminal to answer on.
   */
  fix?: boolean | string;
  fixDryRun?: boolean;
}

function fail(message: string): never {
  console.error(`api-doctor: ${message}`);
  process.exit(2);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Runs the scan pipeline and builds a report. Shared by the scan and the re-verify pass. */
async function scanToReport(directory: string, onlyProviders?: string[]) {
  const start = performance.now();
  const spinner = createSpinner('Scanning for API integrations…');
  let scanOutput;
  try {
    scanOutput = await scan(directory, { onlyProviders });
  } finally {
    spinner.stop();
  }
  const {
    results,
    detected,
    rawPackages,
    directory: scannedDir,
    filesScanned,
    filesContent,
    coverage,
    languagesScanned,
  } = scanOutput;
  const elapsedMs = performance.now() - start;
  const report = buildReport({
    results,
    detected,
    directory: scannedDir,
    filesScanned,
    filesContent,
    durationMs: elapsedMs,
    version: pkg.version,
    coverage,
    languagesScanned,
  });
  return {
    report,
    scannedDir,
    filesContent,
    results,
    detected,
    rawPackages,
    filesScanned,
    coverage,
    elapsedMs,
  };
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
  .option(
    '--fix [agent]',
    `Open a coding agent on the fixable findings without asking (${FIX_AGENTS.map((a) => a.id).join('|')})`,
  )
  .option('--no-fix', 'Never offer to fix — scan and exit (implied outside a terminal)')
  .option('--fix-dry-run', 'Print the fix prompt instead of opening an agent')
  .option(
    '--agent-model <model>',
    'AI agents: identify yourself — set this to your own model id (e.g. claude-opus-4-8)',
  )
  .action(async (directory: string, opts: CliOptions) => {
    const noTelemetry = opts.telemetry === false;

    // `fix` used to be a subcommand. Muscle memory (and 0.0.16's README) still
    // types it, and without this it would be read as a directory named "fix".
    let requestedFix = opts.fix;
    if (directory === 'fix' && !isDirectory('fix')) {
      console.log('api-doctor: `fix` is now a flag — running `api-doctor --fix` instead.\n');
      directory = '.';
      if (requestedFix !== false) requestedFix = true;
    }

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

    // The handoff prints prose and takes over the terminal; both would corrupt
    // a stream meant to be piped into something else.
    if (format && (requestedFix || opts.fixDryRun)) {
      fail(`--fix cannot be combined with --format ${format} — run the scan and the fix separately`);
    }

    if (typeof requestedFix === 'string' && !agentById(requestedFix)) {
      fail(
        `unknown --fix agent "${requestedFix}" (expected ${FIX_AGENTS.map((a) => a.id).join(', ')})`,
      );
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

    try {
      const {
        report,
        scannedDir,
        results,
        detected,
        rawPackages,
        filesScanned,
        coverage,
        elapsedMs,
      } = await scanToReport(directory, onlyProviders);

      const outputPath = opts.output
        ? resolve(opts.output)
        : join(scannedDir, DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILE);
      const rel = relative(scannedDir, outputPath);
      const reportDisplayPath = rel.startsWith('..') ? outputPath : rel;

      // Read before trackRun writes this run's entry, so the delta compares
      // against the previous run rather than this one.
      const previousScore = readProjectHistory(scannedDir)?.last_score;

      const fixMode = resolveFixMode({
        requested: requestedFix,
        dryRun: opts.fixDryRun ?? false,
        structuredOutput: format !== undefined,
        interactive: canPrompt(),
      });
      const willOfferFix =
        (fixMode === 'ask' || fixMode === 'run') && filterFixableFindings(report).length > 0;

      await emitReport(results, detected, report, {
        quiet: opts.quiet,
        verbose: opts.verbose,
        format,
        noReport: opts.report === false,
        outputPath,
        reportDisplayPath,
        elapsedMs,
        rawPackages,
        versions: resolveProviderVersions(detected, scannedDir),
        previousScore,
        suppressInstallHint: willOfferFix,
      });

      await trackRun({
        version: pkg.version,
        results,
        detected,
        score: report.summary.score,
        durationMs: elapsedMs,
        noTelemetry,
        projectDir: scannedDir,
        filesScanned,
        agentModel: opts.agentModel ?? process.env['API_DOCTOR_AGENT_MODEL'],
        coverage,
      });

      // The fix phase runs after the report is on screen: the agent session
      // takes over the terminal, and on exit the scan is what the user scrolls
      // back to.
      await runFixPhase({
        report,
        scannedDir,
        displayDirectory: directory,
        mode: fixMode,
        requestedAgent: typeof requestedFix === 'string' ? requestedFix : undefined,
        noTelemetry,
        reportPath: opts.report === false ? undefined : reportDisplayPath,
      });

      // Status describes the scan this run performed. Whatever the agent did
      // afterwards is unmeasured here by design — the agent verified itself
      // inside its session, and re-scanning to grade it is exactly the loop
      // this command no longer owns.
      const errors = countErrors(results);
      const warningsExceeded =
        maxWarnings !== undefined && report.summary.warnings > maxWarnings;

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

interface FixPhaseInput {
  /** The scan that was just printed. */
  report: Report;
  /** Resolved directory the agent session runs in. */
  scannedDir: string;
  /** Directory as the user typed it, for the retrigger hint. */
  displayDirectory: string;
  /** Already resolved from the flags and the terminal by the caller. */
  mode: FixMode;
  /** Agent named by `--fix <agent>`, when one was. */
  requestedAgent?: string;
  noTelemetry: boolean;
  /**
   * Report file the agent can read for full finding detail, as it will look
   * from the scanned directory. Undefined under `--no-report`, which makes the
   * prompt carry every detail inline instead.
   */
  reportPath?: string;
}

/**
 * Asks which agent should take the findings.
 *
 * The menu is the whole opt-in: choosing a row is how the user says yes, and
 * "Skip for now" (or escape) is a first-class answer, so a plain scan can end
 * without anything being opened.
 */
async function chooseAgent(count: number): Promise<FixAgent | undefined> {
  const agents = detectFixAgents();
  const chosen = await selectFromList({
    title: `${count} error(s) can be fixed. Open them in:`,
    items: buildAgentMenu(agents),
    initialIndex: defaultAgentIndex(agents),
  });
  return chosen && chosen !== 'skip' ? agentById(chosen) : undefined;
}

/**
 * Hands the errors to the user's own coding agent. Called after the report has
 * been printed; returns once the session the user opened has closed.
 */
async function runFixPhase(input: FixPhaseInput): Promise<void> {
  const { report, scannedDir, mode, noTelemetry } = input;
  if (mode === 'skip') return;

  const targeted = filterFixableFindings(report);
  const baseTelemetry = {
    version: pkg.version,
    providers: [...new Set(targeted.map((f) => f.rule.split('/')[0]))],
    targeted: targeted.length,
    dryRun: mode === 'dry-run',
    noTelemetry,
  };
  const trackIdle = (): Promise<void> => trackFix({ ...baseTelemetry, launched: false });

  if (targeted.length === 0) {
    // Silence would read as "nothing was wrong" when the user asked for a fix
    // over a report full of findings this command does not hand over.
    if (mode !== 'ask') {
      for (const line of describeNothingToFix(report.findings.length)) console.log(line);
      await trackIdle();
    }
    return;
  }

  if (mode === 'dry-run') {
    console.log(buildFixPrompt(targeted, input.reportPath));
    await trackIdle();
    return;
  }

  const agent =
    mode === 'ask'
      ? await chooseAgent(targeted.length)
      : input.requestedAgent
        ? agentById(input.requestedAgent)
        : defaultFixAgent();

  if (!agent) {
    for (const line of describeRetrigger(input.displayDirectory)) console.log(line);
    await trackIdle();
    return;
  }

  // Checked before anything is copied or printed, so a missing CLI ends in one
  // clear message rather than "opening Codex…" followed by a failure. Picking an
  // uninstalled agent off the menu is a choice, not a tool failure — only an
  // explicit `--fix <agent>` in a script exits non-zero for it.
  if (!isOnPath(agent.command)) {
    for (const line of describeMissingAgent(agent)) console.error(line);
    await trackIdle();
    if (mode !== 'ask') process.exit(2);
    return;
  }

  // Clipboard, not argv: the session opens with an empty input so the user
  // reads the prompt and submits it themselves.
  const prompt = buildFixPrompt(targeted, input.reportPath);
  const copied = await copyToClipboard(prompt);
  if (!copied) console.log(`\n${prompt}`);
  for (const line of describeHandoff(agent, copied)) console.log(line);

  const { launched } = await launchAgent(agent, scannedDir);
  if (!launched) {
    await trackFix({ ...baseTelemetry, agent: agent.id, launched: false });
    for (const line of describeMissingAgent(agent)) console.error(line);
    process.exit(2);
  }

  // No re-scan here. The prompt tells the agent to run api-doctor itself and
  // keep going until the scan is clean — verification belongs inside the
  // session, where the agent can still act on the answer. By the time this
  // process regains the terminal, the work is over.
  for (const line of describeSessionEnd()) console.log(line);

  await trackFix({ ...baseTelemetry, agent: agent.id, launched: true });
}

program.parse();
