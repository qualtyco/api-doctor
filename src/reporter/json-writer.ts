/**
 * Writes the structured Report to disk. When writing into the default
 * `.api-doctor/` directory, seeds a `.gitignore` (`*`) so the report folder is
 * ignored by default; users can opt in to committing it.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { MigrationReport, Report } from '../types.js';

export const DEFAULT_REPORT_DIR = '.api-doctor';
export const DEFAULT_REPORT_FILE = 'report.json';

function writeJson(value: unknown, outputPath: string): void {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  // Seed `.gitignore` only inside our own `.api-doctor/` directory, and only once.
  if (basename(dir) === DEFAULT_REPORT_DIR) {
    const gitignorePath = `${dir}/.gitignore`;
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, '*\n', 'utf-8');
    }
  }

  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export function writeReport(report: Report, outputPath: string): void {
  writeJson(report, outputPath);
}

/**
 * Writes a migration plan beside the scan report.
 *
 * Its own file rather than a section of `report.json`, because the two answer
 * different questions and have different lifetimes: the scan report is rewritten
 * by every run, while a plan is generated once, worked through, and then wants
 * to be gone. Sharing a file would mean an ordinary scan either wiping a plan
 * mid-migration or carrying a stale one forward.
 */
export function writeMigrationReport(report: MigrationReport, outputPath: string): void {
  writeJson(report, outputPath);
}
