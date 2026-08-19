import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPORT_DIR = '.api-doctor';
const RUN_HISTORY_FILE = 'run-history.json';

export interface ProjectRunHistory {
  last_score: number;
  last_run: string;
  run_count: number;
  /**
   * Removed-SDK-symbol names present in the last run's compatibility findings
   * (closed vocabulary from the compat manifests). Lets the next run report
   * compat_fixed_since_last_run — the metric the compatibility class exists
   * to measure. Absent on histories written before the field existed.
   */
  compat_symbols?: string[];
}

function historyPath(projectDir: string): string {
  return join(projectDir, REPORT_DIR, RUN_HISTORY_FILE);
}

export function readProjectHistory(projectDir: string): ProjectRunHistory | null {
  try {
    const path = historyPath(projectDir);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as ProjectRunHistory;
  } catch {
    return null;
  }
}

export function writeProjectHistory(projectDir: string, history: ProjectRunHistory): void {
  try {
    mkdirSync(join(projectDir, REPORT_DIR), { recursive: true });
    writeFileSync(historyPath(projectDir), JSON.stringify(history, null, 2), 'utf-8');
  } catch {
    // Never throw — disk errors must not surface to the user.
  }
}
