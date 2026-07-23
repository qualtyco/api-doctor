/**
 * Markdown export. Produces a self-contained document a user can paste into a
 * coding agent: every finding with code context, rationale, and fix, plus an
 * embedded handoff prompt at the end.
 */
import { basename } from 'node:path';
import { getRuleDocsMeta } from '../plugin/rule-registry.js';
import { providers } from '../providers/index.js';
import type { Finding, ProviderCoverage, Report } from '../types.js';

/** Maps a finding's result rule id to the rule's longer-form rationale. */
function rationaleByRule(): Map<string, string> {
  const map = new Map<string, string>();
  for (const provider of providers) {
    for (const rule of provider.oxlintRules) {
      const docs = getRuleDocsMeta(rule.key);
      if (docs?.rationale) map.set(rule.resultRule, docs.rationale);
    }
  }
  return map;
}

function codeBlock(finding: Finding): string {
  const { lines, highlightedLine } = finding.codeSnippet;
  const body = lines
    .map((line) => (line.number === highlightedLine ? `${line.text} // ← issue` : line.text))
    .join('\n');
  return ['```typescript', body, '```'].join('\n');
}

function references(finding: Finding): string | undefined {
  const parts: string[] = [];
  if (finding.cwe) parts.push(finding.cwe);
  if (finding.owasp) parts.push(`OWASP ${finding.owasp}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Coverage is context, not work. The explicit not-a-task-list label matters:
 * the agent handoff prompt below tells agents to fix everything in this
 * document, and without the label an agent will import unused SDK surface
 * into a codebase that doesn't need it.
 */
function coverageSection(all: ProviderCoverage[] | undefined): string[] {
  // Entries with nothing used carry no information — emitting the heading and
  // its "do NOT add unused surface" paragraph with no content underneath is
  // worse than silence, especially directly above the agent-handoff prompt.
  const coverage = (all ?? []).filter((entry) => entry.used.length > 0);
  if (coverage.length === 0) return [];
  const out: string[] = [];
  out.push('## SDK surface (informational — not a task list)');
  out.push('');
  out.push(
    'This section records which SDK methods this codebase calls. It is informational ' +
      'context only. Do NOT treat unused SDK surface as an issue to fix, and do NOT ' +
      'add code for capabilities the project does not need.',
  );
  out.push('');
  for (const entry of coverage) {
    const provider = providers.find((p) => p.name === entry.provider);
    const title = provider?.displayName ?? entry.provider;
    out.push(`**${title}** — using: ${entry.used.map((m) => `\`${m}\``).join(', ')}`);
    out.push('');
  }
  return out;
}

const HANDOFF_PROMPT =
  'Please review these api-doctor findings and fix each one. Reference the docs ' +
  "links if you're uncertain about any fix. Process them in order — earlier issues " +
  'may affect later ones.';

export function renderMarkdown(report: Report): string {
  const { summary, scanMeta, tool, findings } = report;
  const rationales = rationaleByRule();
  const out: string[] = [];

  out.push('# api-doctor report');
  out.push('');
  out.push(`**Score:** ${summary.score}/100 (${summary.severity})`);
  out.push(`**Generated:** ${new Date(scanMeta.scannedAt).toUTCString()}`);
  out.push(`**Project:** ${basename(scanMeta.directory)}`);
  out.push(`**Tool:** api-doctor v${tool.version}`);
  out.push('');

  out.push('## Summary');
  out.push('');
  out.push(`- ${summary.errors} errors`);
  out.push(`- ${summary.warnings} warnings`);
  out.push(`- ${summary.info} info notices`);
  out.push(
    `- ${summary.totalIssues} total issues across ${scanMeta.filesScanned} files`,
  );
  out.push('');

  out.push('## Issues to fix');
  out.push('');

  if (findings.length === 0) {
    out.push('No issues found. Nothing to fix.');
    out.push('');
    out.push(...coverageSection(report.coverage));
    return `${out.join('\n')}\n`;
  }

  findings.forEach((finding, index) => {
    out.push(`### ${index + 1}. ${finding.message} [${finding.severity}]`);
    out.push(`**File:** \`${finding.location.file}:${finding.location.line}\``);
    out.push(`**Rule:** \`${finding.rule}\``);
    const refs = references(finding);
    if (refs) out.push(`**References:** ${refs}`);
    out.push('');
    out.push(codeBlock(finding));
    out.push('');
    const rationale = rationales.get(finding.rule);
    if (rationale) {
      out.push(`**Why this matters:** ${rationale}`);
      out.push('');
    }
    out.push(`**Fix:** ${finding.fix}`);
    out.push('');
    if (finding.docsUrl) {
      out.push(`**Docs:** ${finding.docsUrl}`);
      out.push('');
    }
    out.push('---');
    out.push('');
  });

  out.push(...coverageSection(report.coverage));

  out.push('## How to fix these with a coding agent');
  out.push('');
  out.push(
    'Copy this entire file and paste it into Cursor, Claude Code, or any AI coding ' +
      'agent with a prompt like:',
  );
  out.push('');
  out.push(`> "${HANDOFF_PROMPT}"`);
  out.push('');

  return `${out.join('\n')}\n`;
}
