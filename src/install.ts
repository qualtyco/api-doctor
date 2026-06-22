/**
 * Installs api-doctor as an agent skill so coding agents read
 * `.api-doctor/report.json` and fix findings without being told to.
 *
 * One canonical skill file is copied to `skills/api-doctor/SKILL.md`.
 * Claude Code, Cursor, and AGENTS.md each point at that same file.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Canonical skill path inside the user's project (single source of truth). */
export const SKILL_RELATIVE_PATH = join('skills', 'api-doctor', 'SKILL.md');

/** True when `install` has already copied the canonical skill into `directory`. */
export function isAgentSkillInstalled(directory: string): boolean {
  return existsSync(join(directory, SKILL_RELATIVE_PATH));
}

export const INSTALL_COMMAND = 'npx @api-doctor/cli install';

const AGENTS_MARKER_START = '<!-- api-doctor:start -->';
const AGENTS_MARKER_END = '<!-- api-doctor:end -->';

interface AgentPointer {
  path: string;
  content: string;
}

function bundledSkillPath(): string {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const skillPath = join(packageRoot, SKILL_RELATIVE_PATH);
  if (!existsSync(skillPath)) {
    throw new Error(`Bundled skill not found at ${skillPath}`);
  }
  return skillPath;
}

function cursorRule(): AgentPointer {
  return {
    path: join('.cursor', 'rules', 'api-doctor.mdc'),
    content: `---
description: api-doctor — handle integration audit findings
alwaysApply: false
---

@skills/api-doctor/SKILL.md
`,
  };
}

function agentsSection(): string {
  return `${AGENTS_MARKER_START}
## api-doctor

Follow [skills/api-doctor/SKILL.md](skills/api-doctor/SKILL.md).
${AGENTS_MARKER_END}`;
}

export interface InstallResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

export interface InstallOptions {
  /** Overwrite an existing \`skills/api-doctor/SKILL.md\` from the package bundle. */
  force?: boolean;
}

function installCanonicalSkill(
  directory: string,
  force: boolean,
  created: string[],
  updated: string[],
  skipped: string[],
): void {
  const destPath = join(directory, SKILL_RELATIVE_PATH);
  mkdirSync(dirname(destPath), { recursive: true });

  if (existsSync(destPath) && !force) {
    skipped.push(SKILL_RELATIVE_PATH);
    return;
  }

  const isNew = !existsSync(destPath);
  copyFileSync(bundledSkillPath(), destPath);
  (isNew ? created : updated).push(SKILL_RELATIVE_PATH);
}

function installClaudeSymlink(directory: string, updated: string[]): void {
  const claudeDir = join(directory, '.claude', 'skills', 'api-doctor');
  const claudeSkillPath = join(claudeDir, 'SKILL.md');
  const canonicalPath = join(directory, SKILL_RELATIVE_PATH);
  const linkTarget = relative(claudeDir, canonicalPath);

  mkdirSync(claudeDir, { recursive: true });

  if (existsSync(claudeSkillPath)) {
    try {
      unlinkSync(claudeSkillPath);
    } catch {
      // Fall through to symlink attempt.
    }
  }

  try {
    symlinkSync(linkTarget, claudeSkillPath, 'file');
    updated.push(`${join('.claude', 'skills', 'api-doctor', 'SKILL.md')} → ${SKILL_RELATIVE_PATH}`);
  } catch {
    const fallback = `---
name: api-doctor
description: Check AI-generated API integration code for silent bugs before shipping.
---

Read and follow [skills/api-doctor/SKILL.md](../../../skills/api-doctor/SKILL.md).
`;
    writeFileSync(claudeSkillPath, fallback, 'utf-8');
    updated.push(join('.claude', 'skills', 'api-doctor', 'SKILL.md'));
  }
}

/** Installs the canonical skill and agent pointers into \`directory\`. */
export function installAgentFiles(
  directory: string,
  options: InstallOptions = {},
): InstallResult {
  const { force = false } = options;
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  installCanonicalSkill(directory, force, created, updated, skipped);
  installClaudeSymlink(directory, updated);

  for (const file of [cursorRule()]) {
    const fullPath = join(directory, file.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    const isNew = !existsSync(fullPath);
    writeFileSync(fullPath, file.content, 'utf-8');
    (isNew ? created : updated).push(file.path);
  }

  const agentsPath = join(directory, 'AGENTS.md');
  const section = agentsSection();
  if (existsSync(agentsPath)) {
    const existing = readFileSync(agentsPath, 'utf-8');
    const startIdx = existing.indexOf(AGENTS_MARKER_START);
    const endIdx = existing.indexOf(AGENTS_MARKER_END);
    const next =
      startIdx !== -1 && endIdx !== -1
        ? existing.slice(0, startIdx) +
          section +
          existing.slice(endIdx + AGENTS_MARKER_END.length)
        : `${existing.trimEnd()}\n\n${section}\n`;
    writeFileSync(agentsPath, next, 'utf-8');
    updated.push('AGENTS.md');
  } else {
    writeFileSync(agentsPath, `# Agent instructions\n\n${section}\n`, 'utf-8');
    created.push('AGENTS.md');
  }

  return { created, updated, skipped };
}
