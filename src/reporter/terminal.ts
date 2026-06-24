/**
 * Formats and prints scan results: detected providers, 0–100 score,
 * terminal header (icon, progress bar), and grouped issue list.
 *
 * This is the default human terminal output and is intentionally kept stable.
 */
import pc from 'picocolors';
import { INSTALL_COMMAND } from '../install.js';
import { providers } from '../providers/index.js';
import type { DetectedProvider, ScanResult } from '../types.js';
import { lineDelay, revealDelay } from './animate.js';

const ISSUES_URL = 'https://github.com/qualtyco/api-doctor/issues';
const BAR_WIDTH = 24;

export interface ReportOptions {
  verbose?: boolean;
  elapsedMs?: number;
}

interface IssueGroup {
  rule: string;
  message: string;
  fix: string;
  docsUrl?: string;
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

async function printDetectedProviders(detected: DetectedProvider[]): Promise<void> {
  console.log(pc.bold('Detected APIs & SDKs'));
  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    const label = manifest?.displayName ?? d.name;
    const via = pc.dim(`via ${detectionSourceLabel(d.source)}`);

    if (d.checked) {
      const ruleCount = manifest?.oxlintRules.length ?? 0;
      const checks = pc.dim(`— ${ruleCount} check${ruleCount === 1 ? '' : 's'}`);
      console.log(`  ${pc.green('✓')} ${label} ${via} ${checks}`);
    } else {
      console.log(`  ${pc.dim('○')} ${label} ${via} ${pc.dim('— no checks yet')}`);
    }
    await revealDelay();
  }
  console.log('');
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

function groupResults(results: ScanResult[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const r of results) {
    let group = groups.get(r.rule);
    if (!group) {
      group = { rule: r.rule, message: r.message, fix: r.fix, docsUrl: r.docsUrl, items: [] };
      groups.set(r.rule, group);
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

async function printIssueGroups(groups: IssueGroup[], verbose: boolean): Promise<void> {
  for (const group of groups) {
    const count = group.items.length;
    const severity = group.items[0]?.severity;
    const countColor = severity === 'warning' ? pc.yellow : severity === 'info' ? pc.cyan : pc.red;
    const countLabel = count > 1 ? countColor(` (${count})`) : '';
    const prefix =
      severity === 'warning' ? pc.yellow('×') : severity === 'info' ? pc.cyan('ℹ') : pc.red('×');
    console.log(`${prefix} ${group.message}${countLabel}`);
    await lineDelay();

    for (const [index, item] of group.items.entries()) {
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
  // Info findings are advisory and do not affect the score.
  const score = Math.max(0, 100 - errors * 15 - warnings * 5);
  const fileCount = new Set(results.map((r) => r.file)).size;
  const checked = detected.filter((d) => d.checked);

  console.log('');
  await printDetectedProviders(detected);
  await printHeader(score);
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
    return;
  }

  printSummary(errors, warnings, infos, fileCount, options.elapsedMs);
  console.log('');
  await printIssueGroups(groupResults(results), options.verbose ?? false);
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

export function renderFooter(opts: { reportPath?: string; showInstallHint: boolean }): void {
  console.log(pc.dim('─'.repeat(FOOTER_WIDTH)));

  if (opts.reportPath) {
    console.log('');
    console.log(pc.dim(`  Saved  →  ${opts.reportPath}`));
  }

  if (opts.showInstallHint) {
    const innerWidth = FOOTER_WIDTH - 2; // exclude the two border chars
    const label = 'Connect to your coding agent to fix now';
    const cmd = `  ${INSTALL_COMMAND}`;
    const top = pc.cyan('╭' + '─'.repeat(innerWidth) + '╮');
    const bot = pc.cyan('╰' + '─'.repeat(innerWidth) + '╯');
    const row = (s: string) =>
      pc.cyan('│') + ' ' + padVisible(s, innerWidth - 1) + pc.cyan('│');
    console.log('');
    console.log(top);
    console.log(row(pc.cyan(label)));
    console.log(row(pc.bold(cmd)));
    console.log(bot);
  }

  console.log('');
}
