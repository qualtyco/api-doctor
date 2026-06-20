/**
 * Formats and prints scan results: detected providers, 0–100 score,
 * react-doctor-style header (icon, progress bar), and grouped issue list.
 *
 * This is the default human terminal output and is intentionally kept stable.
 */
import pc from 'picocolors';
import { providers } from '../providers/index.js';
import type { DetectedProvider, ScanResult } from '../types.js';

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

function printDetectedProviders(detected: DetectedProvider[]): void {
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

function printHeader(score: number): void {
  const color = scoreColor(score);
  const icon = headerIcon(score, color);
  const scoreText = `${color(String(score))}${pc.dim(' / 100')} ${color(statusLabel(score))}`;
  const bar = progressBar(score, color);
  const iconColWidth = 8;

  console.log(`${padVisible(icon[0], iconColWidth)}${scoreText}`);
  console.log(`${padVisible(icon[1], iconColWidth)}${bar}`);
  console.log(padVisible(icon[2], iconColWidth));
  console.log(padVisible(icon[3], iconColWidth));
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

function printIssueGroups(groups: IssueGroup[], verbose: boolean): void {
  for (const group of groups) {
    const count = group.items.length;
    const severity = group.items[0]?.severity;
    const countColor = severity === 'warning' ? pc.yellow : severity === 'info' ? pc.cyan : pc.red;
    const countLabel = count > 1 ? countColor(` (${count})`) : '';
    const prefix =
      severity === 'warning' ? pc.yellow('×') : severity === 'info' ? pc.cyan('ℹ') : pc.red('×');
    console.log(`${prefix} ${group.message}${countLabel}`);

    group.items.forEach((item, index) => {
      console.log(pc.dim(`    ${index + 1}. ${item.file}:${item.line}`));
      if (verbose) {
        console.log(pc.dim(`       ${item.snippet}`));
        console.log(pc.cyan(`       Fix: ${group.fix}`));
        if (group.docsUrl) console.log(pc.dim(`       Docs: ${group.docsUrl}`));
      }
    });

    if (!verbose && (group.fix || group.docsUrl)) {
      console.log(pc.cyan(`    → ${group.fix}`));
    }
    console.log('');
  }
}

export function renderTerminalReport(
  results: ScanResult[],
  detected: DetectedProvider[],
  options: ReportOptions = {},
): void {
  if (detected.length === 0) {
    const names = providers.map((p) => p.displayName).join(', ');
    console.log(pc.dim('No API providers detected in this project.'));
    console.log(`Supported providers: ${names}`);
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
  printDetectedProviders(detected);
  printHeader(score);
  console.log('');

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
  printIssueGroups(groupResults(results), options.verbose ?? false);
}

export function countErrors(results: ScanResult[]): number {
  return results.filter((r) => r.severity === 'error').length;
}
