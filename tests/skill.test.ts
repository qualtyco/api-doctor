import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLAUDE_SKILL_RELATIVE_PATH,
  ensureAgentSkill,
  isAgentSkillInstalled,
  SKILL_RELATIVE_PATH,
} from '../src/skill.js';

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(os.tmpdir(), 'api-doctor-skill-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      chmodSync(dir, 0o755);
    } catch {
      // Only matters for the unwritable-directory case below.
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('ensureAgentSkill', () => {
  it('writes the canonical skill to the cross-tool .agents location', () => {
    const dir = tempDir();
    const { created } = ensureAgentSkill(dir);

    expect(created).toContain(join('.agents', 'skills', 'api-doctor', 'SKILL.md'));
    expect(isAgentSkillInstalled(dir)).toBe(true);

    const content = readFileSync(join(dir, SKILL_RELATIVE_PATH), 'utf-8');
    // Agent Skills frontmatter is what makes the file discoverable at all.
    expect(content).toMatch(/^---\nname: api-doctor\ndescription: /);
    expect(content).toContain('npx @api-doctor/cli@latest .');
    expect(content).toContain('.api-doctor/report.json');
  });

  it('links Claude Code at the same skill, since it reads only its own dir', () => {
    const dir = tempDir();
    const { created } = ensureAgentSkill(dir);
    expect(created).toContain(join('.claude', 'skills', 'api-doctor', 'SKILL.md'));

    // Symlink or pointer file, the agent has to end up at the canonical copy
    // and has to find frontmatter when it gets there.
    const claudeSkill = join(dir, CLAUDE_SKILL_RELATIVE_PATH);
    const content = readFileSync(claudeSkill, 'utf-8');
    expect(content).toMatch(/^---\nname: api-doctor\n/);
    if (lstatSync(claudeSkill).isSymbolicLink()) {
      expect(content).toBe(readFileSync(join(dir, SKILL_RELATIVE_PATH), 'utf-8'));
    } else {
      expect(content).toContain('.agents/skills/api-doctor/SKILL.md');
    }
  });

  it('reports created only on the run that wrote the files', () => {
    const dir = tempDir();
    expect(ensureAgentSkill(dir).created).toHaveLength(2);
    expect(ensureAgentSkill(dir).created).toEqual([]);
  });

  it('adds a missing Claude link without touching the canonical skill', () => {
    const dir = tempDir();
    ensureAgentSkill(dir);

    // A project installed before the Claude link existed.
    rmSync(join(dir, '.claude'), { recursive: true, force: true });
    const custom = '# my custom skill\n';
    writeFileSync(join(dir, SKILL_RELATIVE_PATH), custom, 'utf-8');

    const { created } = ensureAgentSkill(dir);
    expect(created).toEqual([CLAUDE_SKILL_RELATIVE_PATH]);
    expect(readFileSync(join(dir, SKILL_RELATIVE_PATH), 'utf-8')).toBe(custom);
  });

  it('never overwrites a skill the project has edited', () => {
    const dir = tempDir();
    ensureAgentSkill(dir);
    const custom = '# my custom skill\n';
    writeFileSync(join(dir, SKILL_RELATIVE_PATH), custom, 'utf-8');

    expect(ensureAgentSkill(dir).created).toEqual([]);
    expect(readFileSync(join(dir, SKILL_RELATIVE_PATH), 'utf-8')).toBe(custom);
  });

  it('swallows a write failure rather than taking the scan down with it', () => {
    const dir = tempDir();
    chmodSync(dir, 0o500); // readable, not writable

    expect(() => ensureAgentSkill(dir)).not.toThrow();
    expect(ensureAgentSkill(dir).created).toEqual([]);
    expect(existsSync(join(dir, '.agents'))).toBe(false);
  });
});
