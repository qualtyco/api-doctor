import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { installAgentFiles, SKILL_RELATIVE_PATH } from '../src/install.js';

describe('installAgentFiles', () => {
  it('installs one canonical skill and agent pointers', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'api-doctor-install-'));
    try {
      const { created } = installAgentFiles(dir);
      const skillPath = join(dir, SKILL_RELATIVE_PATH);

      expect(readFileSync(skillPath, 'utf-8')).toContain('npx @api-doctor/cli@latest .');
      expect(readFileSync(skillPath, 'utf-8')).toContain('.api-doctor/report.json');
      expect(readFileSync(join(dir, '.cursor', 'rules', 'api-doctor.mdc'), 'utf-8')).toContain(
        '@skills/api-doctor/SKILL.md',
      );
      expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain(SKILL_RELATIVE_PATH);

      const claudeSkill = join(dir, '.claude', 'skills', 'api-doctor', 'SKILL.md');
      const stat = lstatSync(claudeSkill);
      if (stat.isSymbolicLink()) {
        expect(readFileSync(skillPath, 'utf-8')).toEqual(readFileSync(claudeSkill, 'utf-8'));
      } else {
        expect(readFileSync(claudeSkill, 'utf-8')).toContain('skills/api-doctor/SKILL.md');
      }

      expect(created).toContain(SKILL_RELATIVE_PATH);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not overwrite an existing skill without --force', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'api-doctor-install-'));
    try {
      installAgentFiles(dir);
      const skillPath = join(dir, SKILL_RELATIVE_PATH);
      const custom = '# my custom skill\n';
      writeFileSync(skillPath, custom, 'utf-8');

      const { skipped } = installAgentFiles(dir);
      expect(skipped).toContain(SKILL_RELATIVE_PATH);
      expect(readFileSync(skillPath, 'utf-8')).toBe(custom);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes the skill with --force', () => {
    const dir = mkdtempSync(join(os.tmpdir(), 'api-doctor-install-'));
    try {
      installAgentFiles(dir);
      const skillPath = join(dir, SKILL_RELATIVE_PATH);
      writeFileSync(skillPath, '# stale\n', 'utf-8');

      installAgentFiles(dir, { force: true });
      expect(readFileSync(skillPath, 'utf-8')).toContain('npx @api-doctor/cli@latest .');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
