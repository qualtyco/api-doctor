/**
 * The migration mode: `api-doctor . --migrate supabase@2`.
 *
 * A migration plan is the mirror image of a compatibility finding, and the two
 * must never blur together. Compatibility answers "is this code broken against
 * what is installed right now" and is always on. Migration answers "what would
 * have to change to move forward" and exists ONLY because the user named a
 * target on the command line. api-doctor still never recommends an upgrade; it
 * maps one the user has already decided to make.
 *
 * The work is deliberately thin. Detection is the compatibility rules that were
 * already there, run with their version gate reversed (see
 * `plugin/migration-target.ts`); everything in this file is the arrangement of
 * what they found into something an agent can execute top to bottom.
 *
 * The arrangement is the point. A flat list of call sites invites an agent to
 * re-derive the same decision at every one of them, and to attempt the hardest
 * rewrite first with the largest possible diff. Grouping by difficulty — which
 * is derived from each removal's hand-verified `kind` and `wireIdentical`,
 * never assigned per entry — puts the safe bulk work first and leaves the
 * judgement calls to the end, when the surrounding diff is already small.
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { providers, removalName, removalsBySymbol, symbolFromMessage } from './providers/index.js';
import { extractCodeSnippet } from './reporter/snippet.js';
import { getRuleDocsMeta } from './plugin/rule-registry.js';
import type {
  MethodRemoval,
  MigrationChange,
  MigrationDifficulty,
  MigrationGroup,
  MigrationReport,
  MigrationSite,
  MigrationTarget,
  ProviderManifest,
  ScanResult,
  SymbolRemoval,
} from './types.js';

/** Prefix of the per-provider plan file inside `.api-doctor/`. */
export const MIGRATION_FILE_PREFIX = 'migration-';

/** Report file name for a provider's plan, e.g. `migration-supabase.json`. */
export function migrationFileName(provider: string): string {
  return `${MIGRATION_FILE_PREFIX}${provider}.json`;
}

/**
 * The value a missing version component is padded with.
 *
 * Large enough that no real release reaches it, small enough to stay an exact
 * integer. It never appears in output — `label` carries the human form.
 */
const OPEN_UPPER_BOUND = 999999;

/**
 * Parses `supabase@2`, `supabase@2.0.0` or a bare `supabase`.
 *
 * A partial version is padded UPWARD: `supabase@2` means "the 2.x line", so the
 * bound is `2.<max>.<max>` and the plan reaches every removal anywhere in that
 * line. This is the whole correctness of the flag for most providers — padding
 * down to `2.0.0` looked reasonable and quietly produced an empty plan for
 * every SDK whose break did not land exactly on `x.0.0`. Tiptap removes at
 * 3.0.1, s2 at 0.24.0, agentmail at 0.5.12: `--migrate tiptap@3` would have
 * printed "nothing changes" at a project with a dozen broken imports ahead of
 * it. An exact three-part version is left alone, so a caller who means one
 * specific release can still say so.
 *
 * Returns a string on failure rather than throwing, so the CLI can render one
 * consistent error and exit 2 like every other bad flag.
 */
export function parseMigrationTarget(
  raw: string,
  known: ProviderManifest[] = providers,
): MigrationTarget | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: '--migrate expects <provider>@<version>, e.g. supabase@2' };

  const at = trimmed.lastIndexOf('@');
  const name = (at > 0 ? trimmed.slice(0, at) : trimmed).toLowerCase();
  const versionPart = at > 0 ? trimmed.slice(at + 1).trim() : '';

  const manifest = known.find((p) => p.name === name);
  if (!manifest) {
    return { error: `unknown provider "${name}" for --migrate (see --list-providers)` };
  }
  // Data, not code, is what makes a provider migratable: without hand-verified
  // removals there is nothing to plan and the run would print an empty report
  // that reads like "you have nothing to do".
  if (!manifest.compatibility) {
    return {
      error: `${name} has no verified compatibility data, so there is no migration to map`,
    };
  }

  if (!versionPart) {
    return {
      error: `--migrate needs a target version — try ${name}@${suggestTarget(manifest)}`,
    };
  }

  const parts = versionPart.replace(/^[v=]/, '').split('.');
  if (parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) {
    return { error: `--migrate target "${versionPart}" is not a version number (try 2 or 2.0.0)` };
  }

  const given = parts.length;
  const bound = [...parts];
  while (bound.length < 3) bound.push(String(OPEN_UPPER_BOUND));

  return {
    provider: name,
    target: bound.join('.'),
    label: given === 3 ? parts.join('.') : `${parts.join('.')}.x`,
    raw: trimmed,
  };
}

/**
 * A target worth suggesting: the line containing this provider's highest
 * removal.
 *
 * For a 1.0-and-up package that is the major (`2`). For a 0.x package the major
 * carries no meaning — semver puts the breaking axis on the minor there — so
 * the suggestion is `0.<minor>`, which is what a person migrating s2 or
 * agentmail would actually type.
 */
export function suggestTarget(manifest: ProviderManifest): string {
  const highest = highestRemovedIn(manifest);
  if (!highest) return '2';
  const [major, minor] = highest.split('.');
  return major === '0' ? `0.${minor}` : major;
}

/** Both removal shapes for one provider, in one list. */
export function everyRemovalOf(
  manifest: ProviderManifest,
): Array<SymbolRemoval | MethodRemoval> {
  return [
    ...(manifest.compatibility?.removals ?? []),
    ...(manifest.compatibility?.methodRemovals ?? []),
  ];
}

/**
 * The highest version at which this provider removes anything.
 *
 * Used to answer "is there a migration to offer at all" without running a scan:
 * a project already at or past this has nothing left to plan, whatever its code
 * looks like.
 */
export function highestRemovedIn(manifest: ProviderManifest): string | undefined {
  const all = everyRemovalOf(manifest).map((r) => r.removedIn);
  if (!all.length) return undefined;
  return all.reduce((max, v) => (compareTriples(v, max) > 0 ? v : max));
}

/** Local comparator so this module does not depend on the plugin's resolver. */
function compareTriples(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * How much judgement one change needs, read off the removal's own verified
 * facts.
 *
 * Derived rather than declared on purpose. If each entry graded itself, the
 * grade would drift from the facts underneath it — and it would drift in one
 * direction, because everything looks like a rename to whoever just wrote it.
 * `wireIdentical` is the only thing that licenses "mechanical", and it is a
 * field no one may set without having read both published tarballs.
 */
export function difficultyOf(removal: SymbolRemoval | MethodRemoval): MigrationDifficulty {
  switch (removal.kind) {
    case 'rename':
    case 'moved':
      return removal.wireIdentical ? 'mechanical' : 'behavior-check';
    case 'split':
      return 'argument-dependent';
    case 'signature-change':
      return 'restructure';
    case 'removed':
      return 'decision-required';
  }
}

/** Work order: safe bulk first, judgement last. */
export const DIFFICULTY_ORDER: MigrationDifficulty[] = [
  'mechanical',
  'behavior-check',
  'argument-dependent',
  'restructure',
  'decision-required',
];

const GROUP_COPY: Record<MigrationDifficulty, { title: string; guidance: string }> = {
  // Titles cover renames AND moves: both land in these two buckets, and
  // "Mechanical renames" misdescribes an import that changed module but not
  // name.
  mechanical: {
    title: 'Drop-in replacements',
    guidance:
      'The replacement makes the identical call — same HTTP method, path, auth and request shape, verified against both published packages. Apply these first and in bulk: swap the name or the import path and change nothing else. Do not restructure the surrounding code.',
  },
  'behavior-check': {
    title: 'Replacements with a behaviour change',
    guidance:
      'The replacement maps one-to-one but the behaviour does not, so these cannot be applied blind. Read each call site and its Verify line together, then rewrite. If a Verify line names something you cannot confirm from the code in front of you, leave the site alone and list it in your summary instead of guessing.',
  },
  'argument-dependent': {
    title: 'Splits — the arguments decide',
    guidance:
      'One entry point became several, and only the arguments at this specific call site determine which successor is correct. Read the arguments actually passed here — not the ones in the docs example — and pick from the listed options. If the arguments are built dynamically and you cannot tell which branch runs, do not guess: leave it and say so.',
  },
  restructure: {
    title: 'Contract changes — surrounding code moves',
    guidance:
      'The capability survives but the shape of the call does not: synchronous becomes asynchronous, or the return value is wrapped differently. Fixing the call line alone leaves a bug that type-checks. Follow the value: make the enclosing function async where needed, unwrap the new return shape, and check every caller of that enclosing function.',
  },
  'decision-required': {
    title: 'Removed with no successor',
    guidance:
      'There is no replacement. Do not invent one and do not delete the call to make the plan pass. Report each of these in your summary with what the code was using it for, so a person can decide.',
  },
};

/**
 * Standing instructions carried inside the report file itself.
 *
 * Load-bearing, not decoration. `skill.ts` never overwrites an existing
 * SKILL.md, so any project that installed the skill before this feature shipped
 * has one that has never heard of a migration report and never will. An agent
 * has to be able to open this file cold and know what it is holding, which
 * means the file explains itself and depends on no installed skill.
 */
function instructionsFor(report: Omit<MigrationReport, 'instructions'>): string[] {
  return [
    `This file is a MIGRATION PLAN, not a defect report. Every call site listed here works today against ${report.package}@${report.from}. They are listed because they would stop working at ${report.to}.`,
    `The companion file .api-doctor/report.json (kind: "scan") is the other shape: those findings are wrong NOW. Do not confuse the two, and do not treat this file as a list of bugs.`,
    'Work the groups in the order they appear. They are sorted by how much judgement each change needs, so the safe bulk edits land first and the diff for the hard changes stays small and readable.',
    'Each change lists every call site under it. Decide once how that change is made, then apply that decision at each site — do not re-derive it per site.',
    'The `verify` field on each change is hand-written and verified against the published packages. It is the difference between a rename that is safe and one that silently changes behaviour. Read it before editing, not after.',
    'Do not upgrade the package yourself. Rewrite the call sites, then let the developer bump the dependency and run the project.',
    'Do NOT commit, stage, or push. Leave every change uncommitted so the developer can review the diff.',
    'Finish with one line per file you changed, saying what changed and why. Name anything you deliberately left alone and the reason.',
  ];
}

export interface BuildMigrationReportInput {
  target: MigrationTarget;
  /** Package the versions refer to, from the provider's compatibility data. */
  packageName: string;
  /** Version resolved from the project, or undefined when unresolvable. */
  installed?: string;
  /** Compatibility results from the reversed-gate scan. */
  results: ScanResult[];
  directory: string;
  filesContent: Map<string, string>;
  version: string;
  generatedAt?: Date;
}

/**
 * Turns the reversed-gate scan results into the plan.
 *
 * Results reach here as rendered messages, so the structured removal behind
 * each one is recovered by name from `removalsBySymbol` — the same
 * closed-vocabulary lookup the reporter's Verify line uses, with the same
 * guarantee: a message naming nothing known contributes nothing rather than a
 * guess. Anything unrecoverable is dropped, because a plan entry with no
 * verified successor is worse than a missing one.
 */
export function buildMigrationReport(input: BuildMigrationReportInput): MigrationReport {
  const byRemoval = new Map<string, { removal: SymbolRemoval | MethodRemoval; sites: MigrationSite[] }>();

  for (const result of input.results) {
    if (getRuleDocsMeta(result.ruleKey)?.category !== 'compatibility') continue;
    // Same closed-vocabulary recovery the reporter's Verify line uses.
    const name = symbolFromMessage(result.message);
    const removal = name ? removalsBySymbol.get(name) : undefined;
    if (!removal) continue;

    const entry = byRemoval.get(name!) ?? { removal, sites: [] };
    entry.sites.push({
      file: result.file,
      line: result.line,
      column: result.column,
      ...(result.endLine !== undefined ? { endLine: result.endLine } : {}),
      ...(result.endColumn !== undefined ? { endColumn: result.endColumn } : {}),
      codeSnippet: extractCodeSnippet(input.filesContent.get(result.file) ?? '', result.line),
    });
    byRemoval.set(name!, entry);
  }

  const manifest = providers.find((p) => p.name === input.target.provider);
  const docsUrl = manifest?.rules.find((r) => r.key.endsWith('-removed-method'))?.docsUrl
    ?? manifest?.rules.find((r) => r.key.endsWith('-removed-symbol'))?.docsUrl;

  const changes: MigrationChange[] = [...byRemoval.values()].map(({ removal, sites }) => ({
    id: `${input.target.provider}-${removalName(removal)}`,
    from: removalName(removal),
    ...(removal.replacement ? { to: removal.replacement } : {}),
    ...(removal.replacements?.length ? { toOptions: removal.replacements } : {}),
    ...('movedTo' in removal && removal.movedTo ? { movedTo: removal.movedTo } : {}),
    kind: removal.kind,
    difficulty: difficultyOf(removal),
    removedIn: removal.removedIn,
    wireIdentical: removal.wireIdentical,
    verify: removal.verifyHint,
    ...(docsUrl ? { docsUrl } : {}),
    // Deterministic order so a re-run produces a byte-identical plan and a diff
    // of two plans shows only what actually changed.
    sites: sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  }));

  const groups: MigrationGroup[] = DIFFICULTY_ORDER.flatMap((difficulty) => {
    const inGroup = changes
      .filter((c) => c.difficulty === difficulty)
      .sort((a, b) => a.from.localeCompare(b.from));
    if (!inGroup.length) return [];
    return [{ difficulty, ...GROUP_COPY[difficulty], changes: inGroup }];
  });

  const byDifficulty: Partial<Record<MigrationDifficulty, number>> = {};
  for (const group of groups) {
    byDifficulty[group.difficulty] = group.changes.reduce((n, c) => n + c.sites.length, 0);
  }

  const base = {
    kind: 'migration' as const,
    schemaVersion: '1.0.0' as const,
    tool: { name: 'api-doctor' as const, version: input.version },
    provider: input.target.provider,
    package: input.packageName,
    // "unknown" only ever reaches here in tests: the CLI refuses to run a
    // migration it cannot resolve a from-version for, because every gate below
    // depends on that number.
    from: input.installed ?? 'unknown',
    to: input.target.label,
    directory: input.directory,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    ...(docsUrl ? { docsUrl } : {}),
    // The exact version this plan is finished at. Derived from the changes it
    // actually contains, not from the target: a plan for "2.x" that happens to
    // list only 2.0.0 removals is done the moment the project reaches 2.0.0.
    ...(changes.length
      ? {
          completedAt: changes
            .map((c) => c.removedIn)
            .reduce((max, v) => (compareTriples(v, max) > 0 ? v : max)),
        }
      : {}),
    summary: {
      changes: changes.length,
      sites: changes.reduce((n, c) => n + c.sites.length, 0),
      byDifficulty,
    },
    groups,
  };

  return { ...base, instructions: instructionsFor(base) };
}

/**
 * Deletes migration plans this project has finished.
 *
 * A plan is the one artefact api-doctor writes that does not get rewritten by
 * the next run, and that is what makes a stale one dangerous: an agent handed
 * `migration-supabase.json` a month after the upgrade landed will read a list
 * of call sites that no longer exist and set about "fixing" code that is
 * already correct. Once the installed version is at or past the plan's target
 * the plan is provably finished, which is the only moment it is safe to remove
 * without guessing at the developer's intent.
 *
 * Runs on the ordinary scan because that is the command people actually re-run.
 * It never throws and never touches a plan whose target is still ahead.
 */
export function pruneCompletedPlans(
  reportDir: string,
  installedByProvider: Map<string, string>,
): string[] {
  const removed: string[] = [];
  for (const [provider, installed] of installedByProvider) {
    const path = join(reportDir, migrationFileName(provider));
    try {
      if (!existsSync(path)) continue;
      const plan = JSON.parse(readFileSync(path, 'utf-8')) as Partial<MigrationReport>;
      // Only ever delete a file this tool wrote, in the shape it writes.
      if (plan?.kind !== 'migration') continue;
      // `completedAt`, never `to`: `to` is a human label ('2.x') and does not
      // parse as a version. A plan with no changes carries no completedAt and
      // is finished by definition.
      if (typeof plan.completedAt === 'string') {
        if (!/^\d+\.\d+\.\d+$/.test(plan.completedAt)) continue;
        if (compareTriples(installed, plan.completedAt) < 0) continue; // still ahead
      }
      unlinkSync(path);
      removed.push(migrationFileName(provider));
    } catch {
      /* an unreadable or undeletable plan is not worth failing a scan over */
    }
  }
  return removed;
}

/**
 * Where a change is going, in one phrase, for every shape a removal takes.
 *
 * Shared by the terminal renderer and the agent prompt so the two can never
 * describe the same change differently. `movedTo` is checked FIRST: a moved
 * symbol keeps its name, so a destination built from `replacement` alone reads
 * `BubbleMenu → BubbleMenu`, which tells a reader nothing and hides the only
 * thing that actually changed.
 */
export function describeDestination(change: MigrationChange): string {
  if (change.movedTo) {
    return change.to && change.to !== change.from
      ? `${change.to} from '${change.movedTo}'`
      : `import from '${change.movedTo}'`;
  }
  if (change.toOptions?.length) return change.toOptions.join(' | ');
  if (change.to) return change.to;
  return 'no successor';
}
