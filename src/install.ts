/**
 * Installs api-doctor as an agent skill/rule so coding agents read
 * `.api-doctor/report.json` and fix findings without being told to.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const AGENTS_MARKER_START = '<!-- api-doctor:start -->';
const AGENTS_MARKER_END = '<!-- api-doctor:end -->';

const SKILL_BODY = `Run \`npx @api-doctor/cli .\` after writing or editing code that calls a
third-party API SDK (Resend, Stripe, Supabase, and more). It checks the
generated integration code for hardcoded keys, missing webhook
verification, missing idempotency keys, and similar issues that compile
fine but fail silently in production.

Findings are written to \`.api-doctor/report.json\` as structured JSON
(\`findings[]\`, each with \`location.file\`, \`location.line\`, \`message\`,
\`fix\`). Read that file, fix every \`error\` finding before treating the task
as done, and fix \`warning\` findings when the change is reasonable.`;

interface AgentFile {
  path: string;
  content: string;
}

function claudeSkill(): AgentFile {
  return {
    path: join('.claude', 'skills', 'api-doctor', 'SKILL.md'),
    content: `---
name: api-doctor
description: Check AI-generated API integration code for silent bugs before shipping. Use after writing or editing code that calls a third-party API SDK such as Resend, Stripe, or Supabase.
---

${SKILL_BODY}
`,
  };
}

function cursorRule(): AgentFile {
  return {
    path: join('.cursor', 'rules', 'api-doctor.mdc'),
    content: `---
description: Check AI-generated API integration code for silent bugs before shipping
globs:
alwaysApply: false
---

${SKILL_BODY}
`,
  };
}

function agentsSection(): string {
  return `${AGENTS_MARKER_START}\n## api-doctor\n\n${SKILL_BODY}\n${AGENTS_MARKER_END}`;
}

export interface InstallResult {
  created: string[];
  updated: string[];
}

/** Writes/refreshes the Claude Code skill, Cursor rule, and AGENTS.md section. */
export function installAgentFiles(directory: string): InstallResult {
  const created: string[] = [];
  const updated: string[] = [];

  for (const file of [claudeSkill(), cursorRule()]) {
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

  return { created, updated };
}
