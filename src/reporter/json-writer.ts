/**
 * Writes the structured Report to disk. When writing into the default
 * `.api-doctor/` directory, seeds a `.gitignore` (`*`) so the report folder is
 * ignored by default; users can opt in to committing it.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { Report } from '../types.js';

export const DEFAULT_REPORT_DIR = '.api-doctor';
export const DEFAULT_REPORT_FILE = 'report.json';

export function writeReport(report: Report, outputPath: string): void {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  // Seed `.gitignore` only inside our own `.api-doctor/` directory, and only once.
  if (basename(dir) === DEFAULT_REPORT_DIR) {
    const gitignorePath = `${dir}/.gitignore`;
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, '*\n', 'utf-8');
    }
  }

  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}
