#!/usr/bin/env node
/**
 * Weekly SDK source watcher — the half of drift that `check:surface` cannot see.
 *
 * `check:surface` diffs a provider's method *names* (manifest vs published
 * .d.ts) and catches exactly two things: a method the manifest is missing, and
 * a method the manifest still lists that the SDK dropped. That is real drift
 * and it exits 1 on both. But it is blind by construction to everything that
 * happens behind an unchanged signature:
 *
 *   - a retry policy that starts (or stops) covering an error code;
 *   - a default that changes value;
 *   - a cancellation path that stops throwing;
 *   - a parameter that becomes required, or changes units;
 *   - a rename, which it reports as one "missing" plus one "stale" with no
 *     link between them.
 *
 * Those are the changes that break a working integration on upgrade, which is
 * the problem this project exists to help with. Nothing derives them from
 * types — a human reads the commits. This script's job is to make that reading
 * cheap and regular: pull every SDK clone, list what landed since the last
 * baseline, sort it so the interesting commits are at the top, and write a
 * dated report to review.
 *
 * It never edits a manifest, never infers a rule, and never writes a
 * compatibility entry. A changelog is evidence to go read the diff, not a
 * finding. Only a human moves a baseline forward.
 *
 * Usage:
 *   node scripts/sdk-watch.mjs                  # all cloned providers
 *   node scripts/sdk-watch.mjs --provider s2    # one (repeatable)
 *   node scripts/sdk-watch.mjs --no-pull        # report on current HEADs
 *   node scripts/sdk-watch.mjs --since-verified # ignore watch state entirely
 *   node scripts/sdk-watch.mjs --fail-on-new    # exit 1 if anything is new
 *
 * Clone root resolution, first hit wins:
 *   --clones <dir>  →  $API_DOCTOR_SDK_DIR  →  <repo>/../official_sdks
 *
 * Exits 0 even when providers are unclonedable or missing — this is a report,
 * and a partial report beats a failed run. `--fail-on-new` is for CI/cron that
 * wants a signal to notify on.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));

/**
 * One entry per provider whose SDK is developed in a public git repo.
 *
 * `repo` is the clone directory name under the clones root, `pkgDir` the
 * package inside it (monorepos), and `sourceDir` the client source the diff is
 * scoped to — noise from docs/, examples/ and CI config is what makes a weekly
 * report go unread. `url` is printed when the clone is missing so the fix is
 * copy-pasteable.
 *
 * A provider belongs here when reading its commits is worth someone's time,
 * which in practice means it has a surface manifest or rules that encode SDK
 * behaviour. Providers whose SDK is generated per-release from a spec
 * (agentmail, browserbase) still qualify: the generator's output is where a
 * required-parameter change shows up.
 */
const WATCHED = [
  {
    provider: 's2',
    repo: 's2-sdk-typescript',
    pkgDir: 'packages/streamstore',
    sourceDir: 'packages/streamstore/src',
    url: 'https://github.com/s2-streamstore/s2-sdk-typescript',
  },
  {
    provider: 'resend',
    repo: 'resend-node',
    pkgDir: '.',
    sourceDir: 'src',
    url: 'https://github.com/resend/resend-node',
  },
  {
    provider: 'auth0',
    repo: 'node-auth0',
    pkgDir: '.',
    sourceDir: 'src',
    url: 'https://github.com/auth0/node-auth0',
  },
  {
    provider: 'elevenlabs',
    repo: 'elevenlabs-js',
    pkgDir: '.',
    sourceDir: 'src',
    url: 'https://github.com/elevenlabs/elevenlabs-js',
  },
  {
    provider: 'agentmail',
    repo: 'agentmail-node',
    pkgDir: '.',
    sourceDir: 'src',
    url: 'https://github.com/agentmail-to/agentmail-node',
  },
  {
    // Published from a private staging repo, so the public history is mostly
    // release commits — the diff worth reading is in src/resources, where the
    // generator writes the method bodies.
    provider: 'browserbase',
    repo: 'sdk-node',
    pkgDir: '.',
    sourceDir: 'src/resources',
    url: 'https://github.com/browserbase/sdk-node',
  },
  {
    // nx monorepo: packages/core is a DIRECTORY of packages, not a package —
    // the root client is packages/core/supabase-js and its sub-clients
    // (auth-js, storage-js, functions-js, realtime-js, postgrest-js) are
    // siblings, all versioned in lockstep with it. Hence pkgDir on the root
    // package but sourceDir on the whole of packages/core: the breaking
    // changes worth reading land in the sub-clients at least as often as in
    // the root, and one entry has to cover them all.
    provider: 'supabase',
    repo: 'supabase-js',
    pkgDir: 'packages/core/supabase-js',
    sourceDir: 'packages/core',
    url: 'https://github.com/supabase/supabase-js',
  },
  {
    // Tiptap has no HTTP surface, so it has no surface manifest — it is
    // watched for its compatibility data instead. `packages/react` is the
    // scope that matters: the removals recorded so far are React component
    // exports, and the full monorepo diff is unreadable weekly.
    provider: 'tiptap',
    repo: 'tiptap',
    pkgDir: 'packages/react',
    sourceDir: 'packages/react/src',
    url: 'https://github.com/ueberdosis/tiptap',
  },
];

/**
 * Commit-subject patterns that decide review order.
 *
 * Ranking is triage, never a verdict: `interesting` means "read this first",
 * and `routine` means "read it last", not "skip it". A behaviour change can
 * land under any prefix, including `chore`, so nothing is ever filtered out of
 * the report — the tiers only sort.
 */
const INTERESTING = [
  /(^|[\s(])breaking([\s):]|$)/i,
  /\bBREAKING[ -]CHANGE\b/,
  /^\w+(\([^)]*\))?!:/, // conventional-commit `feat!:` / `fix(x)!:`
  /\b(remove|removed|drop|dropped|rename|renamed|deprecat)\w*\b/i,
  /\b(retry|retries|retrying|timeout|cancel|cancellation|abort|idempoten\w*)\b/i,
  /\b(default|defaults)\b/i,
  /\b(required|now\s+returns|no\s+longer)\b/i,
];
const ROUTINE = [
  /^(chore|ci|build|docs|style|test|tests)(\([^)]*\))?:/i,
  /^(bump|update|upgrade)\b/i,
  /\b(dependabot|renovate)\b/i,
  /^Version Packages\b/, // changesets release commits
];

function classify(subject) {
  if (INTERESTING.some((re) => re.test(subject))) return 'interesting';
  if (ROUTINE.some((re) => re.test(subject))) return 'routine';
  return 'normal';
}

/** Runs git in `cwd`; returns trimmed stdout, or null on any failure. */
function git(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Reads `surface.verified` out of a manifest's source text.
 *
 * Source text, not an import: this script must run against an unbuilt tree,
 * matching how check-sdk-surface.mjs reads the same block.
 */
function manifestVerified(provider) {
  const path = join(ROOT, 'src', 'providers', provider, 'manifest.ts');
  if (!existsSync(path)) return null;
  const block = readFileSync(path, 'utf8').match(/surface:\s*\{[\s\S]*?verified:\s*\{([\s\S]*?)\}/);
  if (!block) return null;
  const field = (name) => block[1].match(new RegExp(`${name}:\\s*'([^']*)'`))?.[1] ?? null;
  const version = field('version');
  const commit = field('commit');
  return version && commit ? { version, commit, at: field('at') } : null;
}

function parseArgs(argv) {
  const opts = {
    providers: [],
    clones: null,
    pull: true,
    sinceVerified: false,
    failOnNew: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--provider') opts.providers.push(argv[++i]);
    else if (arg.startsWith('--provider=')) opts.providers.push(arg.slice('--provider='.length));
    else if (arg === '--clones') opts.clones = argv[++i];
    else if (arg.startsWith('--clones=')) opts.clones = arg.slice('--clones='.length);
    else if (arg === '--no-pull') opts.pull = false;
    else if (arg === '--since-verified') opts.sinceVerified = true;
    else if (arg === '--fail-on-new') opts.failOnNew = true;
    else throw new Error(`unknown argument "${arg}"`);
  }
  for (const p of opts.providers) {
    if (!WATCHED.some((w) => w.provider === p)) {
      throw new Error(`--provider names unwatched provider "${p}"\n  known: ${WATCHED.map((w) => w.provider).join(', ')}`);
    }
  }
  return opts;
}

const STATE_PATH = join(ROOT, '.api-doctor', 'sdk-watch.json');

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { providers: {} };
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Collects one provider's report row. Returns a plain object so the rendering
 * below has no git or filesystem work left to do.
 */
function inspect(target, clonesRoot, opts, state) {
  const repoDir = join(clonesRoot, target.repo);
  const row = { ...target, repoDir, status: 'ok', commits: [], notes: [] };

  if (!existsSync(repoDir)) {
    row.status = 'missing';
    row.notes.push(`not cloned — \`git clone ${target.url} "${repoDir}"\``);
    return row;
  }
  if (git(repoDir, ['rev-parse', '--git-dir']) === null) {
    row.status = 'missing';
    row.notes.push('not a git checkout — the diff needs history, not a tarball');
    return row;
  }

  // Pull before anything is read, so the version, the HEAD and the commit list
  // all describe one revision. A dirty tree is someone's work in progress and
  // is never touched — the comparison against current HEAD still holds.
  if (opts.pull) {
    const dirty = git(repoDir, ['status', '--porcelain']);
    if (dirty === null) row.notes.push('could not read git status — did not pull');
    else if (dirty !== '') row.notes.push('uncommitted changes in the clone — did not pull, using current HEAD');
    else if (git(repoDir, ['pull', '--ff-only']) === null) row.notes.push('git pull failed (offline or diverged) — using current HEAD');
  } else {
    row.notes.push('--no-pull: reporting against current HEAD');
  }

  row.head = git(repoDir, ['rev-parse', 'HEAD']);
  row.headDate = git(repoDir, ['log', '-1', '--format=%ad', '--date=short']);

  const pkgPath = join(repoDir, target.pkgDir, 'package.json');
  try {
    row.version = JSON.parse(readFileSync(pkgPath, 'utf8')).version ?? null;
  } catch {
    row.notes.push(`could not read ${target.pkgDir}/package.json`);
  }

  // Two different baselines, deliberately not merged.
  //
  //   verified — the SDK revision a human actually read. Authoritative, and
  //     the only one that answers "is our manifest still true?".
  //   watched  — the HEAD this script reported last week. Answers the much
  //     smaller question "what is new since I last looked?", so a weekly run
  //     does not re-list the same forty commits until someone re-verifies.
  //
  // Both are shown. Collapsing them would let a watch run that nobody acted on
  // look like a verification, which is exactly the confusion `verified` exists
  // to prevent.
  row.verified = manifestVerified(target.provider);
  row.watched = state.providers?.[target.provider]?.commit ?? null;

  const baseline = opts.sinceVerified
    ? row.verified?.commit ?? null
    : row.watched ?? row.verified?.commit ?? null;
  row.baseline = baseline;
  row.baselineKind = !baseline
    ? 'none'
    : baseline === row.watched && !opts.sinceVerified
      ? 'last watch run'
      : 'manifest surface.verified';

  if (!baseline) {
    row.status = 'unbaselined';
    row.notes.push(
      'no baseline yet — add `surface.verified` to the manifest, or re-run to record this HEAD as the watch baseline',
    );
    return row;
  }
  if (git(repoDir, ['cat-file', '-e', `${baseline}^{commit}`]) === null) {
    row.status = 'bad-baseline';
    row.notes.push(`baseline ${baseline.slice(0, 9)} is not in this checkout — force-push, shallow clone, or a wrong commit in the manifest`);
    return row;
  }
  if (baseline === row.head) {
    row.status = 'unchanged';
    return row;
  }

  const scope = target.sourceDir ? ['--', target.sourceDir] : [];
  const log = git(repoDir, ['log', '--format=%h%x00%ad%x00%s', '--date=short', `${baseline}..HEAD`, ...scope]);
  if (log === null) {
    row.status = 'error';
    row.notes.push(`could not diff ${baseline.slice(0, 9)}..HEAD`);
    return row;
  }
  row.commits = (log === '' ? [] : log.split('\n')).map((line) => {
    const [sha, date, subject] = line.split('\0');
    return { sha, date, subject, tier: classify(subject) };
  });
  if (row.commits.length === 0) row.status = 'unchanged';

  row.stat = git(repoDir, ['diff', '--stat', `${baseline}..HEAD`, ...scope]);
  return row;
}

const TIER_ORDER = { interesting: 0, normal: 1, routine: 2 };

function render(rows, opts, clonesRoot, today) {
  const out = [];
  out.push(`# SDK watch — ${today}`);
  out.push('');
  out.push(`Clones: \`${clonesRoot}\``);
  out.push('');
  out.push(
    'What this is: SDK source commits landed since each provider\'s baseline.',
    '`pnpm check:surface` already guards method *names*; this covers the rest —',
    'retry and timeout policy, defaults, cancellation, required parameters,',
    'renames. Reading these is a human job. Nothing here is a finding, and a',
    'commit subject is a reason to open the diff, not evidence on its own.',
  );
  out.push('');

  const changed = rows.filter((r) => r.commits.length > 0);
  const interesting = changed.flatMap((r) => r.commits.filter((c) => c.tier === 'interesting').map((c) => ({ ...c, provider: r.provider })));

  out.push('## Summary');
  out.push('');
  out.push('| Provider | Version | Baseline | New commits | Flagged |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const base = r.baseline ? `\`${r.baseline.slice(0, 9)}\` (${r.baselineKind})` : '—';
    const flagged = r.commits.filter((c) => c.tier === 'interesting').length;
    const count = r.status === 'missing' || r.status === 'bad-baseline' || r.status === 'unbaselined'
      ? r.status
      : String(r.commits.length);
    out.push(`| ${r.provider} | ${r.version ?? '—'} | ${base} | ${count} | ${flagged || '—'} |`);
  }
  out.push('');

  if (interesting.length > 0) {
    out.push('## Read these first');
    out.push('');
    out.push('Subjects matching breaking-change, retry/timeout, cancellation,');
    out.push('default-value, rename or removal wording. The match is a heuristic —');
    out.push('confirm in the diff before acting.');
    out.push('');
    for (const c of interesting) {
      out.push(`- **${c.provider}** \`${c.sha}\` ${c.date} — ${c.subject}`);
    }
    out.push('');
  }

  for (const r of rows) {
    out.push(`## ${r.provider}`);
    out.push('');
    if (r.version) out.push(`- Package version: \`${r.version}\``);
    if (r.head) out.push(`- HEAD: \`${r.head.slice(0, 9)}\` (${r.headDate})`);
    if (r.verified) {
      out.push(`- Manifest verified: \`${r.verified.version}\` at \`${r.verified.commit.slice(0, 9)}\` (${r.verified.at})`);
    } else {
      out.push('- Manifest verified: none — this provider has no `surface.verified` block');
    }
    if (r.watched) out.push(`- Last watch run: \`${r.watched.slice(0, 9)}\``);
    for (const note of r.notes) out.push(`- ⚠️ ${note}`);
    out.push('');

    if (r.commits.length === 0) {
      if (r.status === 'unchanged') out.push(`No commits touching \`${r.sourceDir}\` since the baseline.`);
      out.push('');
      continue;
    }

    const sorted = [...r.commits].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
    out.push(`${r.commits.length} commit(s) touching \`${r.sourceDir}\`:`);
    out.push('');
    for (const c of sorted) {
      const mark = c.tier === 'interesting' ? '🔴 ' : c.tier === 'routine' ? '· ' : '';
      out.push(`- ${mark}\`${c.sha}\` ${c.date} — ${c.subject}`);
    }
    out.push('');
    if (r.stat) {
      out.push('<details><summary>Files changed</summary>');
      out.push('');
      out.push('```');
      out.push(r.stat);
      out.push('```');
      out.push('');
      out.push('</details>');
      out.push('');
    }
    out.push(
      `Review: \`git -C "${r.repoDir}" log -p ${r.baseline.slice(0, 9)}..HEAD -- ${r.sourceDir}\``,
    );
    out.push('');
  }

  out.push('---');
  out.push('');
  out.push('## After reviewing');
  out.push('');
  out.push('- **Nothing behavioural** — no action. The watch baseline advances on its own.');
  out.push('- **Behaviour changed, surface did not** — bump `surface.verified`');
  out.push('  (version, commit, at) in the manifest and say in the comment what you read');
  out.push('  and why it does not change the list.');
  out.push('- **A method was added or removed** — `pnpm check:surface` will already be');
  out.push('  failing; fix the manifest there.');
  out.push('- **A symbol was removed or renamed** — that is a `compatibility.ts` entry,');
  out.push('  and only after comparing both published tarballs by hand. `wireIdentical`');
  out.push('  is never inferred from a changelog.');
  out.push('- **Working code would now behave differently** — that is a candidate rule.');
  out.push('  It needs an audit and fixtures, not a line in this report.');
  return `${out.join('\n')}\n`;
}

let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`sdk-watch: ${err.message}`);
  process.exit(2);
}

const clonesRoot = resolve(
  opts.clones ?? process.env.API_DOCTOR_SDK_DIR ?? join(ROOT, '..', 'official_sdks'),
);
if (!existsSync(clonesRoot)) {
  console.error(`sdk-watch: clones root not found: ${clonesRoot}`);
  console.error('  pass --clones <dir>, set API_DOCTOR_SDK_DIR, or clone the SDKs into ../official_sdks');
  process.exit(2);
}

const targets = opts.providers.length > 0
  ? WATCHED.filter((w) => opts.providers.includes(w.provider))
  : WATCHED;

const state = readState();
const rows = [];
for (const target of targets) {
  process.stdout.write(`${target.provider}: `);
  const row = inspect(target, clonesRoot, opts, state);
  rows.push(row);
  const flagged = row.commits.filter((c) => c.tier === 'interesting').length;
  if (row.status === 'missing') console.log('not cloned');
  else if (row.status === 'unbaselined') console.log('no baseline — recorded this HEAD');
  else if (row.status === 'bad-baseline') console.log('baseline not in checkout');
  else if (row.commits.length === 0) console.log('no new source commits');
  else console.log(`${row.commits.length} new commit(s)${flagged ? `, ${flagged} flagged for review` : ''}`);
}

const today = new Date().toISOString().slice(0, 10);
const reportDir = join(ROOT, 'docs', 'sdk-watch');
mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `${today}.md`);
writeFileSync(reportPath, render(rows, opts, clonesRoot, today));
console.log(`\nreport: ${reportPath}`);

// The watch baseline advances to what was just reported — including for rows
// with nothing new, so a later run against an unchanged clone stays quiet.
// `verified` is never written here: only a human moves that one.
for (const row of rows) {
  if (!row.head) continue;
  state.providers[row.provider] = { commit: row.head, at: today, version: row.version ?? null };
}
writeState(state);

const totalNew = rows.reduce((n, r) => n + r.commits.length, 0);
if (opts.failOnNew && totalNew > 0) {
  console.error(`sdk-watch: ${totalNew} new SDK source commit(s) to review`);
  process.exit(1);
}
