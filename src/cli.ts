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
  buildMigrationPrompt,
  defaultAgentIndex,
  defaultFixAgent,
  describeHandoff,
  describeLaunchGate,
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
import {
  buildMigrationReport,
  migrationFileName,
  parseMigrationTarget,
  pruneCompletedPlans,
} from './migration.js';
import { canPrompt, selectFromList, waitForAcknowledgement } from './select.js';
import { ensureAgentSkill } from './skill.js';
import { providers } from './providers/index.js';
import { createSpinner } from './reporter/animate.js';
import {
  DEFAULT_REPORT_DIR,
  DEFAULT_REPORT_FILE,
  writeMigrationReport,
} from './reporter/json-writer.js';
import { renderMigrationReport } from './reporter/migration-terminal.js';
import { buildReport } from './reporter/report-builder.js';
import { countErrors, emitReport, type OutputFormat } from './reporter/index.js';
import { readProjectHistory } from './run-history.js';
import { scan, ScanError } from './scanner.js';
import { compareSemver } from './plugin/installed-version.js';
import { resolveProviderVersions } from './sdk-versions.js';
import { trackError, trackFix, trackRun } from './telemetry.js';
import type { MigrationReport, MigrationTarget, Report } from './types.js';

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
  /** commander sets this to false when --no-skill is passed. */
  skill?: boolean;
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
  /** `--migrate <provider>@<version>`. Absent on every ordinary scan. */
  migrate?: string;
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
  .option('--no-skill', 'Do not write the agent skill into the project')
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
    '--migrate <target>',
    'Map the call sites that change on the way to a newer SDK (e.g. supabase@2)',
  )
  .option(
    '--agent-model <model>',
    'AI agents: identify yourself — set this to your own model id (e.g. claude-opus-4-8)',
  )
  .action(async (directory: string, opts: CliOptions) => {
    const noTelemetry = opts.telemetry === false;

    // `install` used to be a subcommand. 0.0.16 published it, so it stays
    // recognised — but as a redirect, not a revival: the scan it falls through
    // to is what writes the skill now.
    if (directory === 'install' && !isDirectory('install')) {
      console.log(
        'api-doctor: `install` is gone — a scan writes the agent skill itself. Scanning the current directory instead.\n',
      );
      directory = '.';
    }

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

    // A migration is a different question with a different answer file, so it
    // takes its own path here rather than becoming a mode inside the scan. The
    // ordinary scan below is left exactly as it was — that is the point: a
    // plain `api-doctor .` must behave identically whether or not this feature
    // exists.
    if (opts.migrate !== undefined) {
      const target = parseMigrationTarget(opts.migrate);
      if ('error' in target) fail(target.error);
      // `--migrate` already names the one provider it plans for. Accepting
      // `--provider` alongside it and quietly ignoring it is worse than saying
      // no: a flag that does nothing reads as a flag that worked.
      if (onlyProviders?.length) {
        fail('--provider cannot be combined with --migrate — the target already names the provider');
      }
      try {
        await runMigration({
          directory,
          target,
          opts,
          format,
          noTelemetry,
        });
      } catch (err) {
        if (err instanceof ScanError) {
          await trackError(err, noTelemetry, pkg.version);
          fail(err.message);
        }
        await trackError(err, noTelemetry, pkg.version);
        throw err;
      }
      return;
    }

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

      const versions = resolveProviderVersions(detected, scannedDir);

      // A finished migration plan is worse than no plan: an agent that reads
      // one after the upgrade landed will try to migrate code that is already
      // migrated. Cleared here, on the command people actually re-run.
      if (opts.report !== false) {
        pruneCompletedPlans(
          join(scannedDir, DEFAULT_REPORT_DIR),
          new Map([...versions].map(([name, v]) => [name, v.installed])),
        );
      }

      // Writing the skill is what removes the second command: after any scan
      // that found a provider, an agent opened in this project already knows
      // how to read the report and act on it, with nothing else to run.
      const skill =
        opts.skill !== false && detected.length > 0 ? ensureAgentSkill(scannedDir) : undefined;

      const fixMode = resolveFixMode({
        requested: requestedFix,
        dryRun: opts.fixDryRun ?? false,
        structuredOutput: format !== undefined,
        interactive: canPrompt(),
      });
      await emitReport(results, detected, report, {
        quiet: opts.quiet,
        verbose: opts.verbose,
        format,
        noReport: opts.report === false,
        outputPath,
        reportDisplayPath,
        elapsedMs,
        rawPackages,
        versions,
        previousScore,
        skillPaths: skill?.created,
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

  // The session clears the screen the moment it starts, so everything above
  // would be written and never read. Holding here until a keypress is what
  // makes the handoff instructions something the user actually sees.
  await waitForAcknowledgement(describeLaunchGate(agent));

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

interface MigrationRunInput {
  directory: string;
  target: MigrationTarget;
  opts: CliOptions;
  /**
   * Already validated by the shared flag handling above — never `opts.format`
   * re-read here. Dispatching before that validation meant `--format bogus`
   * exited 2 on a scan and was silently ignored on a migration: the same flag,
   * two behaviours, decided by which branch happened to read it.
   */
  format?: OutputFormat;
  noTelemetry: boolean;
}

/**
 * The `--migrate` run.
 *
 * Structurally the same pipeline as a scan — walk, detect, lint, report, offer
 * the agent — with three deliberate differences:
 *
 *   - `scan()` narrows to this provider's compatibility rules and reverses
 *     their version gate, so what comes back are calls that work today and
 *     would not at the target;
 *   - the plan goes to its own file and never touches `report.json`, which
 *     belongs to the scan and is rewritten by every run of it;
 *   - it always exits 0. A plan is not a defect, and a migration a developer is
 *     considering must never be able to fail their build.
 */
async function runMigration(input: MigrationRunInput): Promise<void> {
  const { directory, target, opts } = input;

  if (input.format === 'markdown') {
    fail('--format markdown is not available for --migrate — use --format json or read the plan file');
  }
  const jsonOut = input.format === 'json';

  const spinner = jsonOut ? undefined : createSpinner(`Mapping the ${target.provider} migration…`);
  let scanOutput;
  try {
    scanOutput = await scan(directory, { migrate: target });
  } finally {
    spinner?.stop();
  }
  const { results, detected, directory: scannedDir, filesContent } = scanOutput;

  // Everything below needs a version to migrate FROM. Each of these exits 0:
  // asking about a provider that is not here, or is already past every removal,
  // is a reasonable question with a short answer, not a tool failure.
  if (detected.length === 0) {
    console.log(`api-doctor: ${target.provider} was not detected in ${directory} — nothing to migrate.`);
    process.exit(0);
  }

  const compatPackage = providers.find((p) => p.name === target.provider)?.compatibility?.package;
  const resolved = resolveProviderVersions(detected, scannedDir).get(target.provider);
  // The version MUST come from the package the removals were verified against.
  // A number read off a sibling package (`@tiptap/core` in a Vue project that
  // has no `@tiptap/react`) would head the plan with a version for a package
  // this project does not install.
  const version = resolved && resolved.packageName === compatPackage ? resolved : undefined;
  if (!version) {
    // Unresolvable must never be read as "latest" here either. Without a
    // starting version the plan cannot say which removals are ahead of this
    // project and which are behind, and a plan built on a guess is worse than
    // no plan.
    fail(
      `could not resolve an installed version of ${compatPackage ?? target.provider} in ${directory} — a migration plan needs to know which version you are starting from`,
    );
  }

  // A target at or below the installed version is not a migration. Planning it
  // anyway produces a report headed "2.112.3 → 2.0.0", which reads as a
  // downgrade api-doctor is proposing — and downgrades are exactly as far
  // outside this tool's remit as upgrades are.
  const ahead = compareSemver(target.target, version.installed);
  if (ahead !== null && ahead <= 0) {
    console.log(
      `api-doctor: ${target.provider} is already at ${version.installed} — ${target.label} is not ahead of it, so there is nothing to map.`,
    );
    process.exit(0);
  }

  const packageName = version.packageName;

  const report = buildMigrationReport({
    target,
    packageName,
    installed: version.installed,
    installedVersions: version.versions,
    results,
    directory: scannedDir,
    filesContent,
    version: pkg.version,
  });

  const outputPath = opts.output
    ? resolve(opts.output)
    : join(scannedDir, DEFAULT_REPORT_DIR, migrationFileName(target.provider));
  const rel = relative(scannedDir, outputPath);
  const displayPath = rel.startsWith('..') ? outputPath : rel;
  const wroteFile = opts.report !== false;
  if (wroteFile) writeMigrationReport(report, outputPath);

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(0);
  }

  if (opts.quiet) {
    const parts = [
      report.summary.sites === 0
        ? `Migration ${target.provider}→${report.to}: nothing to change`
        : `Migration ${target.provider}→${report.to}: ${report.summary.sites} site(s), ${report.summary.changes} change(s)`,
    ];
    if (wroteFile) parts.push(`→ ${displayPath}`);
    console.log(parts.join('  '));
  } else {
    renderMigrationReport(report, { reportDisplayPath: wroteFile ? displayPath : undefined });
  }

  await runMigrationFixPhase({
    report,
    scannedDir,
    displayDirectory: directory,
    mode: resolveFixMode({
      requested: opts.fix,
      dryRun: opts.fixDryRun ?? false,
      // --quiet is a machine-readable mode, like --format: it must never end at
      // an interactive menu.
      structuredOutput: opts.quiet === true,
      interactive: canPrompt(),
    }),
    requestedAgent: typeof opts.fix === 'string' ? opts.fix : undefined,
    noTelemetry: input.noTelemetry,
    reportPath: wroteFile ? displayPath : undefined,
  });

  // Always zero. The whole category is "work you could choose to do".
  process.exit(0);
}

interface MigrationFixPhaseInput {
  report: MigrationReport;
  scannedDir: string;
  displayDirectory: string;
  mode: FixMode;
  requestedAgent?: string;
  noTelemetry: boolean;
  reportPath?: string;
}

/**
 * Hands the plan to an agent, on the same terms as the fix phase: the prompt
 * goes to the clipboard, the agent opens empty, and the user presses enter.
 */
async function runMigrationFixPhase(input: MigrationFixPhaseInput): Promise<void> {
  const { report, scannedDir, mode } = input;
  if (mode === 'skip' || report.summary.sites === 0) return;

  const prompt = buildMigrationPrompt(report, input.reportPath);

  if (mode === 'dry-run') {
    console.log(prompt);
    return;
  }

  const agent =
    mode === 'ask'
      ? await chooseMigrationAgent(report.summary.sites)
      : input.requestedAgent
        ? agentById(input.requestedAgent)
        : defaultFixAgent();

  if (!agent) {
    for (const line of describeMigrationRetrigger(input.displayDirectory, report)) {
      console.log(line);
    }
    return;
  }

  if (!isOnPath(agent.command)) {
    for (const line of describeMissingAgent(agent)) console.error(line);
    if (mode !== 'ask') process.exit(2);
    return;
  }

  const copied = await copyToClipboard(prompt);
  if (!copied) console.log(prompt);
  for (const line of describeHandoff(agent, copied)) console.log(line);
  await waitForAcknowledgement(describeLaunchGate(agent));

  const { launched } = await launchAgent(agent, scannedDir);
  if (!launched) {
    for (const line of describeMissingAgent(agent)) console.error(line);
    process.exit(2);
  }
  for (const line of describeSessionEnd()) console.log(line);
}

async function chooseMigrationAgent(sites: number): Promise<FixAgent | undefined> {
  const agents = detectFixAgents();
  const chosen = await selectFromList({
    title: `${sites} call site(s) to migrate. Open them in:`,
    items: buildAgentMenu(agents),
    initialIndex: defaultAgentIndex(agents),
  });
  return chosen && chosen !== 'skip' ? agentById(chosen) : undefined;
}

/** How to start the handoff later, echoing the target the user asked for. */
function describeMigrationRetrigger(directory: string, report: MigrationReport): string[] {
  const dir = directory === '.' ? '' : ` ${directory}`;
  const major = report.to.split('.')[0];
  return [
    '',
    'To hand this plan to an agent:',
    `  api-doctor${dir} --migrate ${report.provider}@${major} --fix`,
  ];
}

/**
 * Accepts `api-doctor migrate supabase@2` as a spelling of
 * `api-doctor --migrate supabase@2`.
 *
 * Rewritten in argv rather than handled like the `install` and `fix` redirects
 * inside the action, because unlike those this one takes an argument: the
 * command has a single `[directory]` positional, so `migrate supabase@2` would
 * be rejected as an excess argument before any of our code ran.
 *
 * The flag is the real surface. Two subcommands have already been retired from
 * this CLI and each left a redirect behind; adding a third would be the third
 * time. This exists so that typing the obvious thing works, not as a second
 * way to invoke the tool.
 */
function normalizeArgv(argv: string[]): string[] {
  const [node, script, first, second, ...rest] = argv;
  if (first !== 'migrate') return argv;
  // `migrate` naming a real directory means what it says.
  if (isDirectory('migrate')) return argv;
  if (!second || second.startsWith('-')) {
    fail('`migrate` needs a target — try `api-doctor --migrate supabase@2`');
  }
  return [node, script, '--migrate', second, ...rest];
}

program.parse(normalizeArgv(process.argv));
