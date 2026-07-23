import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aggregateAiAuthors,
  classifyCommit,
  detectAgentSessions,
  detectAgentSignals,
  detectConfigMarkers,
  extractAiderModels,
  extractClaudeSessionModels,
  mungeClaudeProjectDir,
  parseGitLog,
  resolveAiModel,
  sanitizeModelSlug,
  type AgentSession,
  type AiAuthor,
  type ParsedCommit,
} from '../src/agent-detector.js';
import { detectProviders } from '../src/detector.js';

const REC = '\x1e';
const UNIT = '\x1f';
const END = '\x1d';

function rawCommit(author: string, email: string, body: string, files: string[]): string {
  return `${REC}${author}${UNIT}${email}${UNIT}${body}${END}\n${files.join('\n')}\n`;
}

describe('classifyCommit', () => {
  it('extracts agent and model from a Claude Code trailer that names the model', () => {
    const ai = classifyCommit(
      'Jane Dev',
      'jane@example.com',
      'Add webhook handler\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>',
    );
    expect(ai).toEqual({ agent: 'claude-code', model: 'claude-opus-4-8' });
  });

  it('returns a null model for a bare Claude trailer', () => {
    const ai = classifyCommit(
      'Jane Dev',
      'jane@example.com',
      'Fix bug\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    );
    expect(ai).toEqual({ agent: 'claude-code', model: null });
  });

  it('recognizes Cursor agent trailers', () => {
    const ai = classifyCommit(
      'Jane Dev',
      'jane@example.com',
      'Refactor\n\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>',
    );
    expect(ai).toEqual({ agent: 'cursor', model: null });
  });

  it('recognizes GitHub Copilot trailers', () => {
    const ai = classifyCommit(
      'Jane Dev',
      'jane@example.com',
      'Add tests\n\nCo-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>',
    );
    expect(ai).toEqual({ agent: 'github-copilot', model: null });
  });

  it('recognizes Devin bot commits by author', () => {
    const ai = classifyCommit('devin-ai-integration[bot]', 'devin-ai-integration[bot]@users.noreply.github.com', 'Update deps');
    expect(ai).toEqual({ agent: 'devin', model: null });
  });

  it('recognizes aider by its author-name suffix', () => {
    const ai = classifyCommit('Jane Dev (aider)', 'jane@example.com', 'Apply edits');
    expect(ai).toEqual({ agent: 'aider', model: null });
  });

  it('falls back to the Generated-with-Claude-Code body marker', () => {
    const ai = classifyCommit(
      'Jane Dev',
      'jane@example.com',
      'Ship feature\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    );
    expect(ai).toEqual({ agent: 'claude-code', model: null });
  });

  it('returns null for a plain human commit', () => {
    expect(classifyCommit('Jane Dev', 'jane@example.com', 'Fix typo')).toBeNull();
  });
});

describe('parseGitLog', () => {
  it('parses authors, bodies, and file lists across records', () => {
    const raw =
      rawCommit('Jane Dev', 'jane@example.com', 'human commit', ['src/a.ts']) +
      rawCommit(
        'Jane Dev',
        'jane@example.com',
        'ai commit\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>',
        ['src/email.ts', 'src/other.ts'],
      );
    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({ files: ['src/a.ts'], ai: null });
    expect(commits[1]?.files).toEqual(['src/email.ts', 'src/other.ts']);
    expect(commits[1]?.ai).toEqual({ agent: 'claude-code', model: 'claude-sonnet-4-5' });
  });

  it('rebases repo-root-relative paths onto the scanned subdirectory', () => {
    const raw = rawCommit('Jane Dev', 'jane@example.com', 'x', [
      'apps/web/src/email.ts',
      'README.md',
    ]);
    const commits = parseGitLog(raw, 'apps/web/');
    // README.md lives outside the scanned subdir and is dropped.
    expect(commits[0]?.files).toEqual(['src/email.ts']);
  });
});

describe('aggregateAiAuthors', () => {
  const commits: ParsedCommit[] = [
    { files: ['src/email.ts'], ai: { agent: 'claude-code', model: 'claude-opus-4-8' } },
    { files: ['src/email.ts'], ai: { agent: 'claude-code', model: 'claude-opus-4-8' } },
    { files: ['src/billing.ts'], ai: { agent: 'cursor', model: null } },
    { files: ['src/unrelated.ts'], ai: null },
  ];

  it('buckets by agent+model with commit counts, most commits first', () => {
    expect(aggregateAiAuthors(commits)).toEqual([
      { agent: 'claude-code', model: 'claude-opus-4-8', commits: 2 },
      { agent: 'cursor', model: null, commits: 1 },
    ]);
  });

  it('scopes attribution to commits touching the given files', () => {
    expect(aggregateAiAuthors(commits, ['src/billing.ts'])).toEqual([
      { agent: 'cursor', model: null, commits: 1 },
    ]);
  });

  it('normalizes Windows-style separators in the requested file list', () => {
    expect(aggregateAiAuthors(commits, ['src\\billing.ts'])).toEqual([
      { agent: 'cursor', model: null, commits: 1 },
    ]);
  });
});

describe('detectConfigMarkers', () => {
  it('reports agents whose marker files exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-markers-'));
    try {
      writeFileSync(join(dir, 'CLAUDE.md'), '# rules', 'utf-8');
      mkdirSync(join(dir, '.cursor'));
      writeFileSync(join(dir, 'AGENTS.md'), '# agents', 'utf-8');
      expect(detectConfigMarkers(dir).sort()).toEqual(['agents-md', 'claude-code', 'cursor']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty list for a directory without markers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-markers-empty-'));
    try {
      expect(detectConfigMarkers(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('detectAgentSignals (real git repo)', () => {
  let repoDir: string;

  function git(...args: string[]): void {
    execFileSync('git', args, { cwd: repoDir, stdio: 'ignore' });
  }

  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'api-doctor-git-'));
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Test User');
    git('config', 'user.email', 'test@example.com');

    writeFileSync(join(repoDir, 'email.ts'), 'export const a = 1;\n', 'utf-8');
    git('add', 'email.ts');
    git(
      'commit',
      '-m',
      'Add email sending\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>',
    );

    writeFileSync(join(repoDir, 'billing.ts'), 'export const b = 2;\n', 'utf-8');
    git('add', 'billing.ts');
    git('commit', '-m', 'Add billing');
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('attributes commits from real git history and scopes by file', async () => {
    const signals = await detectAgentSignals(repoDir);
    expect(signals.commits).toHaveLength(2);
    expect(aggregateAiAuthors(signals.commits)).toEqual([
      { agent: 'claude-code', model: 'claude-opus-4-8', commits: 1 },
    ]);
    expect(aggregateAiAuthors(signals.commits, ['email.ts'])).toEqual([
      { agent: 'claude-code', model: 'claude-opus-4-8', commits: 1 },
    ]);
    expect(aggregateAiAuthors(signals.commits, ['billing.ts'])).toEqual([]);
  });

  it('returns empty commits for a directory that is not a git repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-nogit-'));
    try {
      const signals = await detectAgentSignals(dir);
      expect(signals.commits).toEqual([]);
      expect(signals.configMarkers).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('session artifact parsing', () => {
  it('munges project paths the way Claude Code keys ~/.claude/projects', () => {
    expect(mungeClaudeProjectDir('/Users/jane/my proj/api.code')).toBe(
      '-Users-jane-my-proj-api-code',
    );
  });

  it('extracts unique model ids from Claude session JSONL, dropping placeholders', () => {
    const content =
      '{"message":{"model":"claude-opus-4-8"}}\n' +
      '{"message":{"model":"claude-opus-4-8"}}\n' +
      '{"message":{"model":"<synthetic>"}}\n' +
      '{"message":{"model":"claude-sonnet-5"}}\n';
    expect(extractClaudeSessionModels(content).sort()).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-5',
    ]);
  });

  it('extracts model mentions from aider chat history', () => {
    const content =
      '# aider chat started at 2026-07-01\n' +
      '> Model: gpt-4o with diff edit format\n' +
      'some conversation\n' +
      '# aider chat started at 2026-07-02\n' +
      '> Main model: claude-3-5-sonnet-20241022 with diff edit format\n';
    expect(extractAiderModels(content)).toEqual(['gpt-4o', 'claude-3-5-sonnet-20241022']);
  });

  it('sanitizes free-form model ids into bounded slugs', () => {
    expect(sanitizeModelSlug('Claude Opus 4.8 (Preview)')).toBe('claude-opus-4.8-preview');
    expect(sanitizeModelSlug('x'.repeat(100)).length).toBe(64);
  });
});

describe('detectAgentSessions', () => {
  it('finds Claude Code and aider sessions for a project via an injected home dir', () => {
    const home = mkdtempSync(join(tmpdir(), 'api-doctor-home-'));
    const project = mkdtempSync(join(tmpdir(), 'api-doctor-proj-'));
    try {
      const claudeProjectDir = join(home, '.claude', 'projects', mungeClaudeProjectDir(project));
      mkdirSync(claudeProjectDir, { recursive: true });
      writeFileSync(
        join(claudeProjectDir, 'session-1.jsonl'),
        '{"message":{"model":"claude-opus-4-8"}}\n',
        'utf-8',
      );
      writeFileSync(
        join(claudeProjectDir, 'session-2.jsonl'),
        '{"message":{"model":"claude-opus-4-8"}}\n{"message":{"model":"claude-sonnet-5"}}\n',
        'utf-8',
      );
      writeFileSync(
        join(project, '.aider.chat.history.md'),
        '> Model: gpt-4o with diff edit format\n',
        'utf-8',
      );

      const sessions = detectAgentSessions([project], home);
      expect(sessions).toEqual([
        { agent: 'claude-code', model: 'claude-opus-4-8', sessions: 2 },
        { agent: 'claude-code', model: 'claude-sonnet-5', sessions: 1 },
        { agent: 'aider', model: 'gpt-4o', sessions: 1 },
      ]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('matches Codex rollouts to the project by their recorded cwd', () => {
    const home = mkdtempSync(join(tmpdir(), 'api-doctor-home-codex-'));
    const project = mkdtempSync(join(tmpdir(), 'api-doctor-proj-codex-'));
    const otherProject = join(tmpdir(), 'somewhere-else');
    try {
      const day = join(home, '.codex', 'sessions', '2026', '07', '22');
      mkdirSync(day, { recursive: true });
      writeFileSync(
        join(day, 'rollout-1.jsonl'),
        `{"type":"session_meta","payload":{"cwd":${JSON.stringify(project)},"model":"gpt-5.2-codex"}}\n`,
        'utf-8',
      );
      writeFileSync(
        join(day, 'rollout-2.jsonl'),
        `{"type":"session_meta","payload":{"cwd":${JSON.stringify(otherProject)},"model":"gpt-5.2-codex"}}\n`,
        'utf-8',
      );

      expect(detectAgentSessions([project], home)).toEqual([
        { agent: 'openai-codex', model: 'gpt-5.2-codex', sessions: 1 },
      ]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('returns empty for a machine with no agent state', () => {
    const home = mkdtempSync(join(tmpdir(), 'api-doctor-home-empty-'));
    const project = mkdtempSync(join(tmpdir(), 'api-doctor-proj-empty-'));
    try {
      expect(detectAgentSessions([project], home)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });
});

describe('resolveAiModel', () => {
  const gitOpus: AiAuthor[] = [{ agent: 'claude-code', model: 'claude-opus-4-8', commits: 3 }];
  const gitCursor: AiAuthor[] = [{ agent: 'cursor', model: null, commits: 5 }];
  const sessionFable: AgentSession[] = [
    { agent: 'claude-code', model: 'claude-fable-5', sessions: 4 },
  ];

  it('prefers a git-attributed model over everything else', () => {
    expect(resolveAiModel(gitOpus, sessionFable, 'gpt-5.2-codex', ['claude-code'])).toEqual({
      model: 'claude-opus-4-8',
      source: 'git',
    });
  });

  it('prefers self-report over sessions when git has no model', () => {
    expect(resolveAiModel([], sessionFable, 'gpt-5.2-codex', [])).toEqual({
      model: 'gpt-5.2-codex',
      source: 'self-report',
    });
  });

  it('uses a session model when git and self-report have nothing', () => {
    expect(resolveAiModel([], sessionFable, null, [])).toEqual({
      model: 'claude-fable-5',
      source: 'session',
    });
  });

  it('skips a model-less git bucket in favor of one that names a model', () => {
    const mixed: AiAuthor[] = [
      { agent: 'cursor', model: null, commits: 9 },
      { agent: 'claude-code', model: 'claude-sonnet-5', commits: 2 },
    ];
    expect(resolveAiModel(mixed, [], null, [])).toEqual({
      model: 'claude-sonnet-5',
      source: 'git',
    });
  });

  it('falls back to the git agent name when no signal names a model', () => {
    expect(resolveAiModel(gitCursor, [], null, [])).toEqual({ model: 'cursor', source: 'git' });
  });

  it('falls back to config markers last, skipping generic agents-md', () => {
    expect(resolveAiModel([], [], null, ['agents-md', 'cursor'])).toEqual({
      model: 'cursor',
      source: 'config-marker',
    });
    expect(resolveAiModel([], [], null, ['agents-md'])).toEqual({ model: null, source: null });
  });

  it('returns null when there is no evidence at all', () => {
    expect(resolveAiModel([], [], null, [])).toEqual({ model: null, source: null });
  });
});

describe('detectProviders provider file attribution', () => {
  it('records which files reference a detected provider', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-provider-files-'));
    try {
      const filesContent = new Map<string, string>([
        ['src/email.ts', "import { Resend } from 'resend';\n"],
        ['src/unrelated.ts', 'export const x = 1;\n'],
      ]);
      const { detected } = await detectProviders(dir, filesContent);
      const resend = detected.find((d) => d.name === 'resend');
      expect(resend?.files).toEqual(['src/email.ts']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
