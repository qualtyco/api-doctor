/**
 * Terminal output for a `--migrate` run.
 *
 * Deliberately not the scan's renderer. There is no score, no severity and no
 * pass/fail here: nothing in a migration plan is wrong yet, and rendering it in
 * the vocabulary of defects would make an upgrade the user has not committed to
 * look like a problem they already have. What the screen shows is the shape of
 * the work — how many sites, and how much of it is safe — with the detail left
 * to the plan file, which is what the agent reads anyway.
 */
import pc from 'picocolors';
import { describeDestination, DIFFICULTY_ORDER } from '../migration.js';
import type { MigrationDifficulty, MigrationReport } from '../types.js';

/** One-line summary of what each tier costs the reader, shown beside the count. */
const DIFFICULTY_BLURB: Record<MigrationDifficulty, string> = {
  mechanical: 'verified identical on the wire — safe to apply in bulk',
  'behavior-check': 'maps one-to-one, but the behaviour differs',
  'argument-dependent': 'successor depends on the arguments at each site',
  restructure: 'call shape changes — surrounding code moves with it',
  'decision-required': 'no successor; a person has to decide',
};

const DIFFICULTY_COLOR: Record<MigrationDifficulty, (s: string) => string> = {
  mechanical: pc.green,
  'behavior-check': pc.yellow,
  'argument-dependent': pc.yellow,
  restructure: pc.magenta,
  'decision-required': pc.red,
};

export interface MigrationRenderOptions {
  /** Where the plan was written, as shown to the user. Absent under --no-report. */
  reportDisplayPath?: string;
  elapsedMs?: number;
}

export function renderMigrationReport(
  report: MigrationReport,
  options: MigrationRenderOptions = {},
): void {
  console.log('');
  console.log(
    pc.bold(`Migration plan  ${report.package}  ${report.from} → ${report.to}`),
  );
  console.log('');

  if (report.summary.sites === 0) {
    // Said plainly, because the alternative reading — "the scan failed" — is
    // the one a reader jumps to when a command prints nothing.
    console.log(`  ${pc.green('✓')} No call sites in this project change on the way to ${report.to}.`);
    console.log(
      pc.dim('    Every symbol and method this code uses still exists in the target version.'),
    );
    console.log('');
    return;
  }

  const siteWord = report.summary.sites === 1 ? 'call site' : 'call sites';
  const changeWord = report.summary.changes === 1 ? 'change' : 'changes';
  console.log(
    `  ${report.summary.sites} ${siteWord} across ${report.summary.changes} ${changeWord}`,
  );
  console.log('');

  // Fixed order, not the order they happened to be found in: this is the order
  // the work should be done in, and the screen is the first place that is said.
  for (const difficulty of DIFFICULTY_ORDER) {
    const group = report.groups.find((g) => g.difficulty === difficulty);
    if (!group) continue;
    const sites = group.changes.reduce((n, c) => n + c.sites.length, 0);
    const color = DIFFICULTY_COLOR[difficulty];
    console.log(`  ${color('●')} ${group.title} ${pc.dim(`— ${sites} ${sites === 1 ? 'site' : 'sites'}`)}`);
    console.log(pc.dim(`      ${DIFFICULTY_BLURB[difficulty]}`));
    for (const change of group.changes) {
      console.log(
        `      ${change.from}${pc.dim(` → ${describeDestination(change)}`)} ${pc.dim(`(${change.sites.length})`)}`,
      );
    }
    console.log('');
  }

  if (options.reportDisplayPath) {
    console.log(pc.dim(`  Plan written to ${options.reportDisplayPath}`));
    console.log(
      pc.dim('  Every site, with the verified note on what to check, is in that file.'),
    );
  }
  // No upgrade advice, in either direction. The user already decided to make
  // this move; api-doctor's job ended at mapping it.
  console.log('');
}
