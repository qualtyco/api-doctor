/**
 * Detects which AI coding agents (and, when git history names them, which
 * models) produced the code in a scanned project. Two independent signals:
 *
 *   1. Config markers — agent-specific files checked into the repo
 *      (CLAUDE.md, .cursor/, .github/copilot-instructions.md, …).
 *   2. Git history — Co-authored-by trailers and bot author names that
 *      coding agents stamp onto commits. Claude Code trailers include the
 *      model name (e.g. "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"),
 *      which is the only reliable per-model signal across agents.
 *
 * Everything here is best-effort telemetry input: any failure (no git, not a
 * repo, timeout) degrades to empty signals and must never break a scan.
 */
import { execFile } from 'node:child_process';
import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 3000;
const GIT_MAX_COMMITS = 1000;
const GIT_MAX_BUFFER = 10 * 1024 * 1024;

// Record/unit/group separators keep the custom git log format unambiguous
// even though commit bodies contain arbitrary newlines.
const REC_SEP = '\x1e';
const UNIT_SEP = '\x1f';
const BODY_END = '\x1d';

/** One AI authorship bucket aggregated over a set of commits. */
export interface AiAuthor {
  /** Normalized agent slug, e.g. `claude-code`, `cursor`, `github-copilot`. */
  agent: string;
  /** Normalized model slug when the commit names one (e.g. `claude-opus-4-8`), else null. */
  model: string | null;
  commits: number;
}

export interface ParsedCommit {
  /** Paths touched by the commit, relative to the scanned directory, `/`-separated. */
  files: string[];
  /** AI attribution for this commit, or null when no agent signature matched. */
  ai: { agent: string; model: string | null } | null;
}

/**
 * One AI agent session bucket found in local agent state (e.g. Claude Code's
 * `~/.claude/projects/` transcripts). `sessions` counts distinct sessions in
 * which the model appears. Unlike git trailers, this signal exists even when
 * the human makes every commit themselves — it attributes the machine the
 * scan runs on, not the repo's history.
 */
export interface AgentSession {
  agent: string;
  model: string | null;
  sessions: number;
}

export interface AgentSignals {
  /** Agent slugs whose config files exist in the scanned directory. */
  configMarkers: string[];
  /** Recent commits (newest first) with per-commit AI attribution. */
  commits: ParsedCommit[];
  /** Models used in local agent sessions for this project. */
  sessions: AgentSession[];
}

/** Marker files/dirs each agent conventionally leaves in a repo. */
const CONFIG_MARKERS: Array<{ agent: string; paths: string[] }> = [
  { agent: 'claude-code', paths: ['CLAUDE.md', '.claude'] },
  { agent: 'cursor', paths: ['.cursorrules', '.cursor'] },
  { agent: 'github-copilot', paths: [join('.github', 'copilot-instructions.md')] },
  { agent: 'windsurf', paths: ['.windsurfrules', '.windsurf'] },
  { agent: 'gemini-cli', paths: ['GEMINI.md', '.gemini'] },
  { agent: 'aider', paths: ['.aider.conf.yml'] },
  { agent: 'openai-codex', paths: ['.codex'] },
  // AGENTS.md is a cross-agent convention (Codex, Amp, Cursor all read it) —
  // reported as its own slug rather than guessing which agent wrote it.
  { agent: 'agents-md', paths: ['AGENTS.md'] },
];

export function detectConfigMarkers(directory: string): string[] {
  const found: string[] = [];
  for (const { agent, paths } of CONFIG_MARKERS) {
    try {
      if (paths.some((p) => existsSync(join(directory, p)))) found.push(agent);
    } catch {
      // unreadable path — skip this marker
    }
  }
  return found;
}

/** Turns "Opus 4.8" / "Sonnet 4.5" into a stable slug like `claude-opus-4-8`. */
function toModelSlug(name: string): string {
  return `claude-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

/**
 * Classifies a single commit's authorship metadata against known AI agent
 * signatures. Checks Co-authored-by trailers first (most specific), then the
 * commit author name, then body markers.
 */
export function classifyCommit(
  authorName: string,
  authorEmail: string,
  body: string,
): { agent: string; model: string | null } | null {
  const coAuthors = [...body.matchAll(/^co-authored-by:\s*(.+?)\s*<([^>]*)>\s*$/gim)].map(
    (m) => ({ name: m[1] ?? '', email: (m[2] ?? '').toLowerCase() }),
  );

  for (const ca of coAuthors) {
    // Claude Code: "Co-Authored-By: Claude <noreply@anthropic.com>" — newer
    // versions embed the model, e.g. "Claude Opus 4.8".
    if (ca.email === 'noreply@anthropic.com' || /^claude\b/i.test(ca.name)) {
      const model = /^claude\s+(.+)$/i.exec(ca.name.trim())?.[1];
      return { agent: 'claude-code', model: model ? toModelSlug(model) : null };
    }
    if (ca.email === 'cursoragent@cursor.com' || /^cursor(\s+agent)?$/i.test(ca.name)) {
      return { agent: 'cursor', model: null };
    }
    if (/^copilot(-swe-agent)?$/i.test(ca.name)) {
      return { agent: 'github-copilot', model: null };
    }
    if (/chatgpt|codex/i.test(ca.name)) {
      return { agent: 'openai-codex', model: null };
    }
  }

  if (/devin-ai-integration/i.test(authorName) || /devin-ai-integration/i.test(authorEmail)) {
    return { agent: 'devin', model: null };
  }
  if (/google-labs-jules/i.test(authorName)) {
    return { agent: 'jules', model: null };
  }
  if (/\(aider\)\s*$/i.test(authorName)) {
    return { agent: 'aider', model: null };
  }
  if (/generated with \[?claude code\]?/i.test(body)) {
    return { agent: 'claude-code', model: null };
  }
  if (/^cursor agent$/i.test(authorName)) {
    return { agent: 'cursor', model: null };
  }
  return null;
}

/**
 * Parses `git log --name-only` output produced with the format
 * `%x1e%an%x1f%ae%x1f%B%x1d`. `repoPrefix` (from `git rev-parse --show-prefix`)
 * rebases repo-root-relative paths onto the scanned directory; commits whose
 * files all live outside it keep an empty file list.
 */
export function parseGitLog(raw: string, repoPrefix = ''): ParsedCommit[] {
  const commits: ParsedCommit[] = [];
  for (const record of raw.split(REC_SEP)) {
    if (!record.trim()) continue;
    const bodyEnd = record.indexOf(BODY_END);
    if (bodyEnd === -1) continue;
    const [authorName = '', authorEmail = '', body = ''] = record.slice(0, bodyEnd).split(UNIT_SEP);
    const files = record
      .slice(bodyEnd + 1)
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.startsWith(repoPrefix))
      .map((f) => f.slice(repoPrefix.length));
    commits.push({ files, ai: classifyCommit(authorName, authorEmail, body) });
  }
  return commits;
}

/**
 * Aggregates AI-attributed commits into (agent, model) buckets with counts,
 * sorted most-commits-first. When `files` is given, only commits touching at
 * least one of those paths count — this is what scopes attribution to the
 * files where a specific provider's SDK is used.
 */
export function aggregateAiAuthors(commits: ParsedCommit[], files?: string[]): AiAuthor[] {
  const wanted = files ? new Set(files.map((f) => f.replace(/\\/g, '/'))) : null;
  const buckets = new Map<string, AiAuthor>();
  for (const commit of commits) {
    if (!commit.ai) continue;
    if (wanted && !commit.files.some((f) => wanted.has(f))) continue;
    const key = `${commit.ai.agent}|${commit.ai.model ?? ''}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.commits += 1;
    else buckets.set(key, { agent: commit.ai.agent, model: commit.ai.model, commits: 1 });
  }
  return [...buckets.values()].sort((a, b) => b.commits - a.commits);
}

// Session scanning is capped hard: newest files only, tail reads only. This
// runs once per scan inside telemetry and must stay effectively free.
const MAX_SESSION_FILES = 10;
const SESSION_TAIL_BYTES = 256 * 1024;
const CODEX_HEAD_BYTES = 16 * 1024;
const MAX_CODEX_FILES = 30;

/** Normalizes a free-form model name into a bounded, enumerable slug. */
export function sanitizeModelSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Claude Code keys `~/.claude/projects/` by the project path with every non-alphanumeric char as `-`. */
export function mungeClaudeProjectDir(absPath: string): string {
  return absPath.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Unique model ids in one Claude Code session transcript. Assistant messages
 * carry `"model":"claude-…"`; placeholder values like `<synthetic>` are noise.
 */
export function extractClaudeSessionModels(content: string): string[] {
  const models = new Set<string>();
  for (const m of content.matchAll(/"model"\s*:\s*"([^"]+)"/g)) {
    const value = m[1] ?? '';
    if (/^[a-z0-9][a-z0-9._:/-]*$/i.test(value)) models.add(sanitizeModelSlug(value));
  }
  return [...models];
}

/**
 * Model names from an aider `.aider.chat.history.md`, one entry per mention
 * (aider logs `> Model: <name> …` / `Main model: <name>` once per session).
 */
export function extractAiderModels(content: string): string[] {
  return [...content.matchAll(/^>?\s*(?:Main model|Model):\s*([^\s,]+)/gim)].map((m) =>
    sanitizeModelSlug(m[1] ?? ''),
  );
}

/** Reads at most `maxBytes` from the end (`tail`) or start (`head`) of a file. */
function readSlice(path: string, maxBytes: number, from: 'head' | 'tail'): string {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, from === 'tail' ? size - len : 0);
    return buf.toString('utf-8');
  } finally {
    closeSync(fd);
  }
}

/** Newest-first .jsonl files directly inside `dir`, capped at `limit`. */
function newestJsonlFiles(dir: string, limit: number): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f))
    .map((p) => ({ p, mtime: statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((e) => e.p);
}

/**
 * Detects which models coded in this project from local agent session state.
 * `candidateDirs` should hold the scanned directory and (when different) the
 * git repo root, since agents key their state by the directory they ran in.
 * Best-effort throughout — unreadable or absent state contributes nothing.
 */
export function detectAgentSessions(candidateDirs: string[], homeDir = homedir()): AgentSession[] {
  const buckets = new Map<string, AgentSession>();
  const add = (agent: string, model: string | null, count = 1): void => {
    const key = `${agent}|${model ?? ''}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.sessions += count;
    else buckets.set(key, { agent, model, sessions: count });
  };
  const candidates = [...new Set(candidateDirs.filter(Boolean).map((d) => resolve(d)))];

  // Claude Code: ~/.claude/projects/<munged-path>/<session-id>.jsonl
  for (const dir of candidates) {
    try {
      const projectDir = join(homeDir, '.claude', 'projects', mungeClaudeProjectDir(dir));
      if (!existsSync(projectDir)) continue;
      for (const file of newestJsonlFiles(projectDir, MAX_SESSION_FILES)) {
        try {
          for (const model of extractClaudeSessionModels(readSlice(file, SESSION_TAIL_BYTES, 'tail'))) {
            add('claude-code', model);
          }
        } catch {
          // unreadable session file — skip
        }
      }
    } catch {
      // unreadable project dir — skip
    }
  }

  // aider: .aider.chat.history.md checked into (or ignored inside) the repo.
  for (const dir of candidates) {
    try {
      const historyPath = join(dir, '.aider.chat.history.md');
      if (!existsSync(historyPath)) continue;
      for (const model of extractAiderModels(readFileSync(historyPath, 'utf-8'))) {
        add('aider', model);
      }
    } catch {
      // unreadable history — skip
    }
  }

  // Codex CLI: ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl; the session meta
  // near the top records the cwd, which ties a rollout to this project.
  try {
    const sessionsRoot = join(homeDir, '.codex', 'sessions');
    if (existsSync(sessionsRoot)) {
      const files: string[] = [];
      const stack = [sessionsRoot];
      while (stack.length > 0 && files.length < MAX_CODEX_FILES) {
        const current = stack.pop();
        if (!current) break;
        // Date-named subdirs sort ascending; pushing sorted means the stack
        // pops newest directories first.
        for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          if (entry.isDirectory()) stack.push(join(current, entry.name));
          else if (entry.name.endsWith('.jsonl')) files.push(join(current, entry.name));
        }
      }
      const cwdNeedles = candidates.map((d) => `"cwd":${JSON.stringify(d)}`);
      for (const file of files.slice(0, MAX_CODEX_FILES)) {
        try {
          const head = readSlice(file, CODEX_HEAD_BYTES, 'head');
          if (!cwdNeedles.some((needle) => head.includes(needle))) continue;
          const model = /"model"\s*:\s*"([^"]+)"/.exec(head)?.[1];
          add('openai-codex', model ? sanitizeModelSlug(model) : null);
        } catch {
          // unreadable rollout — skip
        }
      }
    }
  } catch {
    // unreadable sessions root — skip
  }

  return [...buckets.values()].sort((a, b) => b.sessions - a.sessions);
}

export interface ResolvedAiModel {
  /** Best single answer to "who made this code" — a model slug when known, else an agent slug, else null. */
  model: string | null;
  /** Which signal produced the answer. */
  source: 'git' | 'self-report' | 'session' | 'config-marker' | null;
}

/**
 * Collapses all detection signals into one answer, strongest evidence first:
 * git co-author trailers (file-level proof) → the scanning agent's
 * self-reported model → local session state → an agent name from git when no
 * model is known → config markers. Model names beat bare agent names within
 * each signal.
 */
export function resolveAiModel(
  gitAuthors: AiAuthor[],
  sessions: AgentSession[],
  selfReported: string | null,
  configMarkers: string[],
): ResolvedAiModel {
  const gitWithModel = gitAuthors.find((a) => a.model);
  if (gitWithModel?.model) return { model: gitWithModel.model, source: 'git' };
  if (selfReported) return { model: selfReported, source: 'self-report' };
  const sessionWithModel = sessions.find((s) => s.model);
  if (sessionWithModel?.model) return { model: sessionWithModel.model, source: 'session' };
  const gitAgent = gitAuthors[0]?.agent;
  if (gitAgent) return { model: gitAgent, source: 'git' };
  const sessionAgent = sessions[0]?.agent;
  if (sessionAgent) return { model: sessionAgent, source: 'session' };
  // agents-md is a cross-agent convention — too generic to name an author.
  const marker = configMarkers.find((m) => m !== 'agents-md');
  if (marker) return { model: marker, source: 'config-marker' };
  return { model: null, source: null };
}

async function git(directory: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: directory,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
    windowsHide: true,
  });
  return stdout;
}

/**
 * Collects both signal sources for a scanned directory. Never throws — a
 * missing git binary, non-repo directory, or timeout yields empty commits.
 */
export async function detectAgentSignals(directory: string): Promise<AgentSignals> {
  const configMarkers = detectConfigMarkers(directory);

  let commits: ParsedCommit[] = [];
  let repoRoot: string | null = null;
  try {
    // show-prefix maps repo-root-relative log paths onto the scanned dir
    // (which may be a subdirectory of the repo).
    const repoPrefix = (await git(directory, ['rev-parse', '--show-prefix'])).trim();
    repoRoot = (await git(directory, ['rev-parse', '--show-toplevel'])).trim() || null;
    const raw = await git(directory, [
      'log',
      '-n',
      String(GIT_MAX_COMMITS),
      '--name-only',
      `--format=${REC_SEP}%an${UNIT_SEP}%ae${UNIT_SEP}%B${BODY_END}`,
      '--',
      '.',
    ]);
    commits = parseGitLog(raw, repoPrefix);
  } catch {
    // no git / not a repo / timeout — attribution simply stays empty
  }

  // Agents key local session state by the directory they were launched from —
  // usually the repo root, which may differ from the scanned (sub)directory.
  const sessions = detectAgentSessions(repoRoot ? [directory, repoRoot] : [directory]);

  return { configMarkers, commits, sessions };
}
