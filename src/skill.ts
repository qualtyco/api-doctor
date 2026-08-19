/**
 * Installs api-doctor's agent skill into the scanned project so coding agents
 * read `.api-doctor/report.json` and fix findings without being told to.
 *
 * There is no `install` command. The scan writes the skill itself, because a
 * setup step the user has to discover is a setup step most users never run.
 *
 * Two locations, one file. `.agents/skills/api-doctor/SKILL.md` is the
 * canonical copy and the cross-tool Agent Skills location — Codex reads it as
 * its primary skills directory, Cursor and Gemini CLI read it alongside their
 * own, Copilot implements the same standard. `.claude/skills/api-doctor/` is a
 * link at that copy, because Claude Code discovers skills only from its own
 * directories and would otherwise never see it.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Canonical skill path inside the user's project, relative to the scan root. */
export const SKILL_RELATIVE_PATH = join('.agents', 'skills', 'api-doctor', 'SKILL.md');

/** Where Claude Code looks. It reads neither `.agents/` nor `AGENTS.md`. */
export const CLAUDE_SKILL_RELATIVE_PATH = join('.claude', 'skills', 'api-doctor', 'SKILL.md');

/** True when a scan has already written the canonical skill into `directory`. */
export function isAgentSkillInstalled(directory: string): boolean {
  return existsSync(join(directory, SKILL_RELATIVE_PATH));
}

export interface SkillInstallResult {
  /**
   * Paths written by this run, relative to the scanned directory. Empty when
   * everything was already in place, which is what keeps the notice to once.
   */
  created: string[];
}

function bundledSkillPath(): string {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  return join(packageRoot, 'skills', 'api-doctor', 'SKILL.md');
}

/**
 * Frontmatter is what makes a skill discoverable at all, so the fallback file
 * carries its own rather than pointing at the canonical copy for it.
 */
function claudePointer(linkTarget: string): string {
  return `---
name: api-doctor
description: Check AI-generated API integration code for silent bugs before shipping. Use after writing or editing code that calls a third-party API SDK such as Resend or Supabase.
---

Read and follow [${SKILL_RELATIVE_PATH}](${linkTarget.split('\\').join('/')}).
`;
}

/**
 * Links Claude Code's skills directory at the canonical copy.
 *
 * A symlink keeps one editable file; where symlinks are not permitted (Windows
 * without developer mode) a pointer file preserves the same property, since
 * both send the agent to the same place.
 */
function linkClaudeSkill(directory: string, created: string[]): void {
  const destPath = join(directory, CLAUDE_SKILL_RELATIVE_PATH);
  if (existsSync(destPath)) return;

  const claudeDir = dirname(destPath);
  const linkTarget = relative(claudeDir, join(directory, SKILL_RELATIVE_PATH));
  mkdirSync(claudeDir, { recursive: true });

  try {
    symlinkSync(linkTarget, destPath, 'file');
  } catch {
    writeFileSync(destPath, claudePointer(linkTarget), 'utf-8');
  }
  created.push(CLAUDE_SKILL_RELATIVE_PATH);
}

/**
 * Writes the skill into `directory`, skipping whatever is already there.
 *
 * An existing file is never overwritten: once it is in the project it belongs
 * to the project, and a scan silently reverting someone's edits would be worse
 * than shipping a skill one version behind. The two locations are checked
 * independently, so a project that predates the Claude Code link picks it up on
 * its next scan without the canonical copy being touched.
 *
 * Installing the skill is a side effect of scanning, never the point of it, so
 * every failure here is swallowed — an unwritable directory must not turn a
 * working scan into a crash.
 */
export function ensureAgentSkill(directory: string): SkillInstallResult {
  const created: string[] = [];
  try {
    const destPath = join(directory, SKILL_RELATIVE_PATH);

    if (!existsSync(destPath)) {
      const source = bundledSkillPath();
      if (!existsSync(source)) return { created };
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(source, destPath);
      created.push(SKILL_RELATIVE_PATH);
    }

    // Only ever link at a file that exists — a dangling symlink in someone's
    // .claude/ is worse than no skill at all.
    if (existsSync(destPath)) linkClaudeSkill(directory, created);
  } catch {
    // Never fail a scan over the skill.
  }
  return { created };
}
