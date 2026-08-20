/**
 * Formats and prints scan results: detected providers, 0–100 score,
 * terminal header (icon, progress bar), and grouped issue list.
 *
 * This is the default human terminal output and is intentionally kept stable.
 */
import pc from 'picocolors';
import { providers } from '../providers/index.js';
import type { ProviderVersion } from '../sdk-versions.js';
import { computeScore, type DetectedProvider, type ProviderCoverage, type ScanResult } from '../types.js';
import { lineDelay, revealDelay } from './animate.js';

const ISSUES_URL = 'https://github.com/qualtyco/api-doctor/issues';
const BAR_WIDTH = 24;
/** Beyond this many findings the terminal list truncates and defers to the report file. */
const MAX_TERMINAL_FINDINGS = 20;

export interface ReportOptions {
  verbose?: boolean;
  elapsedMs?: number;
  /** Where the JSON report was written (shown when the finding list truncates). */
  reportDisplayPath?: string;
  /** Informational SDK usage; rendered after the findings, never scored. */
  coverage?: ProviderCoverage[];
  /** Installed SDK version per provider, keyed by provider name. */
  versions?: Map<string, ProviderVersion>;
  /** Score from the previous run on this project, for the delta line. */
  previousScore?: number;
}

interface IssueGroup {
  rule: string;
  message: string;
  fix: string;
  docsUrl?: string;
  /**
   * Taken from the same item the group's `message` came from, so the headline
   * and its Verify line always describe the same finding.
   */
  verifyHint?: string;
  items: ScanResult[];
}

function displayNames(detected: DetectedProvider[]): string {
  return detected
    .map((d) => providers.find((p) => p.name === d.name)?.displayName ?? d.name)
    .join(', ');
}

function detectionSourceLabel(source: DetectedProvider['source']): string {
  switch (source) {
    case 'package.json':
      return 'package.json';
    case 'imports':
      return 'imports';
    case 'url-patterns':
      return 'URL patterns';
  }
}

async function printDetectedProviders(
  detected: DetectedProvider[],
  versions?: Map<string, ProviderVersion>,
): Promise<void> {
  console.log(pc.bold('Detected APIs & SDKs'));
  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    const label = manifest?.displayName ?? d.name;
    const via = pc.dim(`via ${detectionSourceLabel(d.source)}`);
    const version = versions?.get(d.name);
    // Absent when unresolvable — never render a guessed version.
    const versionTag = version ? ` ${version.installed}` : '';

    if (d.checked) {
      const ruleCount = manifest?.rules.length ?? 0;
      const checks = pc.dim(`— ${ruleCount} check${ruleCount === 1 ? '' : 's'}`);
      console.log(`  ${pc.green('✓')} ${label}${versionTag} ${via} ${checks}`);
    } else {
      console.log(`  ${pc.dim('○')} ${label}${versionTag} ${via} ${pc.dim('— no checks yet')}`);
    }
    // States the two versions and stops. Whether the gap matters is the
    // reader's call; this must never read as an upgrade recommendation.
    if (version?.differs) {
      console.log(pc.dim(`      checks verified against ${version.packageName}@${version.verified}`));
    }
    await revealDelay();
  }
  console.log('');
}

/** Renders movement since the last run on this project, when there is any. */
function printScoreDelta(score: number, previousScore?: number): void {
  if (previousScore === undefined || previousScore === score) return;
  const delta = score - previousScore;
  const color = delta > 0 ? pc.green : pc.red;
  const sign = delta > 0 ? '+' : '';
  console.log(
    `  ${color(`${delta > 0 ? '▲' : '▼'} ${sign}${delta}`)}${pc.dim(` since last run (was ${previousScore})`)}`,
  );
}

function scoreColor(score: number): (s: string) => string {
  if (score >= 75) return pc.green;
  if (score >= 50) return pc.yellow;
  return pc.red;
}

function statusLabel(score: number): string {
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Critical';
}

function headerIcon(score: number, color: (s: string) => string): string[] {
  const box = (face: string[]) => [
    color('┌────┐'),
    color(`│${face[0]}│`),
    color(`│${face[1]}│`),
    color('└────┘'),
  ];
  if (score >= 75) return box([' ^^ ', ' ‿‿ ']);
  if (score >= 50) return box([' o o', ' __ ']);
  return box([' >< ', ' == ']);
}

function progressBar(score: number, color: (s: string) => string): string {
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return color('█'.repeat(Math.max(0, filled))) + pc.dim('░'.repeat(Math.max(0, empty)));
}

function padVisible(text: string, width: number): string {
  const plain = text.replace(/\u001b\[[0-9;]*m/g, '');
  const spaces = Math.max(0, width - plain.length);
  return text + ' '.repeat(spaces);
}

async function printHeader(score: number): Promise<void> {
  const color = scoreColor(score);
  const scoreText = `${color(String(score))}${pc.dim(' / 100')} ${color(statusLabel(score))}`;
  const bar = progressBar(score, color);
  const icon = headerIcon(score, color);
  const iconColWidth = 8;
  const lines = [
    `${padVisible(icon[0], iconColWidth)}${scoreText}`,
    `${padVisible(icon[1], iconColWidth)}${bar}`,
    padVisible(icon[2], iconColWidth),
    padVisible(icon[3], iconColWidth),
  ];
  for (const line of lines) {
    console.log(line);
    await lineDelay();
  }
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '';
  const sec = ms / 1000;
  return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
}

/**
 * Groups findings for display, keyed by rule AND message.
 *
 * Rule alone is not enough. Most rules render one fixed message, so keying on
 * the pair changes nothing for them — but compatibility rules set
 * `dynamicMessage`, and every finding they emit names a different symbol,
 * version and successor. Keyed on rule alone, nine removed Supabase methods
 * collapse under whichever one happened to come first, and the group's Verify
 * line — which is deliberately taken from the headline's own finding — then
 * describes a different removal than the eight lines beneath it. A hint about
 * the wrong endpoint is worse than no hint, which is the reason the Verify
 * line has its provenance rule in the first place.
 */
function groupResults(results: ScanResult[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const r of results) {
    const key = `${r.rule}\u0000${r.message}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        rule: r.rule,
        message: r.message,
        fix: r.fix,
        docsUrl: r.docsUrl,
        verifyHint: r.verifyHint,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(r);
  }
  return [...groups.values()];
}

function printSummary(
  errors: number,
  warnings: number,
  infos: number,
  fileCount: number,
  elapsedMs?: number,
): void {
  const parts: string[] = [];
  if (errors > 0) parts.push(pc.red(`${errors} error${errors === 1 ? '' : 's'}`));
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`));
  if (infos > 0) parts.push(pc.cyan(`${infos} info`));
  if (parts.length === 0) {
    console.log(pc.green('No issues found'));
    return;
  }

  const duration = formatDuration(elapsedMs);
  const tail = [
    fileCount > 0 ? `across ${fileCount} file${fileCount === 1 ? '' : 's'}` : '',
    duration ? `in ${duration}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  console.log(`${parts.join(pc.dim(', '))}${tail ? pc.dim(` ${tail}`) : ''}`);
}

async function printIssueGroups(
  groups: IssueGroup[],
  verbose: boolean,
  reportDisplayPath?: string,
): Promise<void> {
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  // --verbose is the escape hatch: it always prints everything.
  const limit = verbose ? Infinity : MAX_TERMINAL_FINDINGS;
  let remaining = total > limit ? limit : Infinity;

  for (const group of groups) {
    if (remaining <= 0) break;
    const count = group.items.length;
    const severity = group.items[0]?.severity;
    const countColor = severity === 'warning' ? pc.yellow : severity === 'info' ? pc.cyan : pc.red;
    const countLabel = count > 1 ? countColor(` (${count})`) : '';
    const prefix =
      severity === 'warning' ? pc.yellow('×') : severity === 'info' ? pc.cyan('ℹ') : pc.red('×');
    console.log(`${prefix} ${group.message}${countLabel}`);
    // Directly under the headline: what changed is only half the finding, and
    // the reader decides whether to trust the rewrite before they open a file.
    if (group.verifyHint) console.log(pc.cyan(`    Verify: ${group.verifyHint}`));
    await lineDelay();

    for (const [index, item] of group.items.entries()) {
      if (remaining <= 0) {
        console.log(pc.dim(`    … and ${count - index} more`));
        break;
      }
      remaining -= 1;
      console.log(pc.dim(`    ${index + 1}. ${item.file}:${item.line}`));
      if (verbose) {
        console.log(pc.dim(`       ${item.snippet}`));
        console.log(pc.cyan(`       Fix: ${group.fix}`));
        if (group.docsUrl) console.log(pc.dim(`       Docs: ${group.docsUrl}`));
      }
      if (group.items.length > 1) await lineDelay();
    }

    if (!verbose && (group.fix || group.docsUrl)) {
      console.log(pc.cyan(`    → ${group.fix}`));
    }
    console.log('');
    await revealDelay();
  }

  if (total > limit) {
    const where = reportDisplayPath
      ? `See ${pc.bold(reportDisplayPath)} for the full report`
      : 'Re-run with --verbose for the full list';
    console.log(pc.yellow(`Showing ${limit} of ${total} findings. `) + pc.dim(`${where}.`));
    console.log('');
  }
}

/**
 * Informational SDK-surface section. Prints nothing when there is nothing to
 * say, and never shows counts, ratios, or unused-method lists.
 */
export function printCoverage(coverage: ProviderCoverage[] | undefined): void {
  if (!coverage?.length) return;
  for (const entry of coverage) {
    if (entry.used.length === 0) continue;
    const label = providers.find((p) => p.name === entry.provider)?.displayName ?? entry.provider;
    console.log(pc.bold(`${label} surface`));
    console.log(pc.dim(`  Using: ${entry.used.join(', ')}`));
    console.log('');
  }
}

export async function renderTerminalReport(
  results: ScanResult[],
  detected: DetectedProvider[],
  options: ReportOptions = {},
): Promise<void> {
  if (detected.length === 0) {
    const names = providers.map((p) => p.displayName).join(', ');
    console.log(pc.dim('No supported Node.js API providers detected in this project.'));
    console.log(`Supported Node.js providers: ${names}`);
    console.log(`Request a provider: ${ISSUES_URL}`);
    return;
  }

  const errors = results.filter((r) => r.severity === 'error').length;
  const warnings = results.filter((r) => r.severity === 'warning').length;
  const infos = results.filter((r) => r.severity === 'info').length;
  const score = computeScore(errors, warnings);
  const fileCount = new Set(results.map((r) => r.file)).size;
  const checked = detected.filter((d) => d.checked);

  console.log('');
  await printDetectedProviders(detected, options.versions);
  await printHeader(score);
  printScoreDelta(score, options.previousScore);
  console.log('');
  await revealDelay();

  if (results.length === 0) {
    const duration = formatDuration(options.elapsedMs);
    const scannedLabel =
      checked.length > 0
        ? `Checked ${checked.map((d) => providers.find((p) => p.name === d.name)?.displayName ?? d.name).join(', ')}`
        : `Found ${displayNames(detected)}`;
    console.log(pc.dim(`${scannedLabel}${duration ? ` in ${duration}` : ''}`));
    console.log('');
    console.log(pc.green(`${pc.bold('✓')} No issues found`));
    console.log('');
    printCoverage(options.coverage);
    return;
  }

  printSummary(errors, warnings, infos, fileCount, options.elapsedMs);
  console.log('');
  await printIssueGroups(groupResults(results), options.verbose ?? false, options.reportDisplayPath);
  printCoverage(options.coverage);
}

export function countErrors(results: ScanResult[]): number {
  return results.filter((r) => r.severity === 'error').length;
}

const FOOTER_WIDTH = 54;

export function renderUnsupportedPackagesHint(): void {
  const innerWidth = FOOTER_WIDTH - 2;
  const border = (s: string) => pc.yellow(s);
  const top = border('╭' + '─'.repeat(innerWidth) + '╮');
  const bot = border('╰' + '─'.repeat(innerWidth) + '╯');
  const row = (s: string) => border('│') + ' ' + padVisible(s, innerWidth - 1) + border('│');

  console.log('');
  console.log(top);
  console.log(row(pc.yellow("This scan saw packages we don't support yet.")));
  console.log(row(pc.yellow('Submit an issue to request support:')));
  console.log(row(pc.bold(pc.yellow(ISSUES_URL))));
  console.log(bot);
}

export function renderFooter(opts: { reportPath?: string; skillPaths?: string[] }): void {
  console.log(pc.dim('─'.repeat(FOOTER_WIDTH)));

  if (opts.reportPath) {
    console.log('');
    console.log(pc.dim(`  Saved  →  ${opts.reportPath}`));
  }

  // Printed only on the run that wrote the skill. It reports files that now
  // exist — there is nothing here for the user to go and run.
  if (opts.skillPaths && opts.skillPaths.length > 0) {
    const innerWidth = FOOTER_WIDTH - 2; // exclude the two border chars
    const top = pc.cyan('╭' + '─'.repeat(innerWidth) + '╮');
    const bot = pc.cyan('╰' + '─'.repeat(innerWidth) + '╯');
    const row = (s: string) =>
      pc.cyan('│') + ' ' + padVisible(s, innerWidth - 1) + pc.cyan('│');
    console.log('');
    console.log(top);
    console.log(row(pc.cyan('Agent skill added to this project')));
    for (const path of opts.skillPaths) console.log(row(pc.bold(`  ${path}`)));
    console.log(row(pc.dim('  run /api-doctor in your agent')));
    console.log(bot);
  }

  console.log('');
}
