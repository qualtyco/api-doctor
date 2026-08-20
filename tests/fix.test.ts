import { describe, expect, it } from 'vitest';
import {
  agentById,
  buildAgentMenu,
  buildFixPrompt,
  defaultAgentIndex,
  defaultFixAgent,
  describeHandoff,
  describeLaunchGate,
  describeMissingAgent,
  describeNothingToFix,
  describeRetrigger,
  describeSessionEnd,
  filterFixableFindings,
  FIX_AGENTS,
  isOnPath,
  resolveFixMode,
  VERIFY_COMMAND,
} from '../src/fix.js';
import type { Finding, FindingCategory, Report, Severity } from '../src/types.js';

function finding(overrides: Partial<Finding> & { rule: string }): Finding {
  return {
    id: `${overrides.rule}-1`,
    category: 'compatibility' as FindingCategory,
    severity: 'error' as Severity,
    message: 'something is wrong',
    fix: 'do the thing',
    location: { file: 'src/a.ts', line: 1, column: 1 },
    codeSnippet: { lines: [], highlightedLine: 1 },
    ...overrides,
  };
}

function report(findings: Finding[]): Report {
  return {
    kind: 'scan',
    schemaVersion: '1.2.0',
    tool: { name: 'api-doctor', version: '0.0.0' },
    scanMeta: {
      directory: '/tmp/x',
      scannedAt: '2026-08-11T00:00:00.000Z',
      durationMs: 1,
      filesScanned: 1,
      providersDetected: [],
    },
    summary: { score: 100, severity: 'excellent', errors: 0, warnings: 0, info: 0, totalIssues: 0 },
    findings,
  };
}

describe('filterFixableFindings', () => {
  it('keeps every error, whatever its category', () => {
    const compat = finding({ rule: 's2/removed-symbol', category: 'compatibility' });
    const security = finding({ rule: 's2/no-hardcoded-access-token', category: 'security' });
    const correctness = finding({ rule: 's2/tail-is-end', category: 'correctness' });

    const kept = filterFixableFindings(report([compat, security, correctness]));

    expect(kept).toEqual([compat, security, correctness]);
  });

  it('leaves warnings and info out — advisory findings would bury the errors', () => {
    const error = finding({ rule: 'r/x', severity: 'error' });
    const warning = finding({ rule: 'r/y', severity: 'warning' });
    const info = finding({ rule: 'r/z', severity: 'info' });

    expect(filterFixableFindings(report([error, warning, info]))).toEqual([error]);
  });

  it('returns empty when nothing is an error', () => {
    expect(filterFixableFindings(report([finding({ rule: 'r/x', severity: 'warning' })]))).toEqual([]);
  });
});

describe('resolveFixMode', () => {
  const base = { dryRun: false, structuredOutput: false, interactive: true };

  it('offers after a plain interactive scan', () => {
    expect(resolveFixMode(base)).toBe('ask');
  });

  it('runs unattended when --fix was passed', () => {
    expect(resolveFixMode({ ...base, requested: true })).toBe('run');
    // Explicit intent beats the missing terminal — the session inherits stdio anyway.
    expect(resolveFixMode({ ...base, requested: true, interactive: false })).toBe('run');
  });

  it('treats a named agent as an answer, so --fix cursor skips the menu', () => {
    expect(resolveFixMode({ ...base, requested: 'cursor' })).toBe('run');
  });

  it('never prompts without a terminal to answer on', () => {
    expect(resolveFixMode({ ...base, interactive: false })).toBe('skip');
  });

  it('never prompts into a piped stream', () => {
    expect(resolveFixMode({ ...base, structuredOutput: true })).toBe('skip');
  });

  it('lets --no-fix win over everything, so CI has one flag that cannot block', () => {
    expect(resolveFixMode({ ...base, requested: false })).toBe('skip');
    expect(resolveFixMode({ ...base, requested: false, dryRun: true })).toBe('skip');
  });

  it('prints the prompt on --fix-dry-run without asking', () => {
    expect(resolveFixMode({ ...base, dryRun: true })).toBe('dry-run');
    expect(resolveFixMode({ ...base, dryRun: true, interactive: false })).toBe('dry-run');
  });
});

describe('buildFixPrompt', () => {
  const f = finding({
    rule: 's2/removed-symbol',
    message: 'createOrReconfigureBasin was removed in 0.24.0 — you have 0.25.0 installed.',
    fix: 'Rename the call to ensureBasin.',
    docsUrl: 'https://s2.dev/docs/sdk/stream-resources',
    location: { file: 'src/provision.ts', line: 12, column: 3 },
  });

  const REPORT = '.api-doctor/report.json';

  it('indexes each finding on one line and defers the detail to the report file', () => {
    const prompt = buildFixPrompt([f], REPORT);

    expect(prompt).toContain(
      'src/provision.ts:12 — createOrReconfigureBasin was removed in 0.24.0',
    );
    expect(prompt).toContain('Read `.api-doctor/report.json` first');
    expect(prompt).toContain('fix guidance');
    expect(prompt).toContain('code snippet');
    // The detail lives in the JSON, so the prompt stays an index, not a dossier.
    expect(prompt).not.toContain('Rename the call to ensureBasin.');
    expect(prompt).not.toContain('https://s2.dev/docs/sdk/stream-resources');
  });

  it('scopes the agent to the errors, since the report also carries warnings', () => {
    const prompt = buildFixPrompt([f], REPORT);

    expect(prompt).toContain('warnings and info — those are not part of this task');
  });

  it('honours a report written somewhere else', () => {
    expect(buildFixPrompt([f], 'build/audit.json')).toContain('Read `build/audit.json` first');
  });

  it('inlines guidance and docs when no report file was written', () => {
    // --no-report: the prompt is the only copy, so it has to carry everything.
    const prompt = buildFixPrompt([f]);

    expect(prompt).toContain('src/provision.ts:12');
    expect(prompt).toContain('createOrReconfigureBasin was removed in 0.24.0');
    expect(prompt).toContain('Rename the call to ensureBasin.');
    expect(prompt).toContain('https://s2.dev/docs/sdk/stream-resources');
    expect(prompt).not.toContain('report.json');
  });

  it('tells the agent not to suppress the check and that any correct shape is fine', () => {
    const prompt = buildFixPrompt([f]);

    // The anti-overfitting contract: intent is supplied, a required shape is not.
    expect(prompt).toContain('no single expected shape');
    expect(prompt).toContain('Do not silence the check');
    expect(prompt).toContain('say so instead of forcing it');
  });

  it('never leaks how the rule matches, with or without the report file', () => {
    for (const prompt of [buildFixPrompt([f]), buildFixPrompt([f], REPORT)]) {
      // Handing over the matcher teaches the agent to satisfy the matcher.
      expect(prompt).not.toContain('CallExpression');
      expect(prompt).not.toContain('ImportDeclaration');
      expect(prompt).not.toContain('AST');
      expect(prompt).not.toContain('oxlint');
      expect(prompt).not.toContain(f.rule);
    }
  });

  it('agrees with the finding count in singular and plural', () => {
    expect(buildFixPrompt([f])).toContain('1 error in');
    expect(buildFixPrompt([f, f])).toContain('2 errors in');
  });

  it('carries findings from any category, not just compatibility', () => {
    const security = finding({
      rule: 's2/no-hardcoded-access-token',
      category: 'security',
      message: 'Access token is hardcoded in source.',
      location: { file: 'src/client.ts', line: 3, column: 1 },
    });

    const prompt = buildFixPrompt([f, security]);

    expect(prompt).toContain('Access token is hardcoded in source.');
    expect(prompt).toContain('src/client.ts:3');
    // Nothing in the framing should imply SDK-version work specifically.
    expect(prompt).not.toContain('compatibility');
  });

  it('hands verification to the agent, pinned to the published CLI', () => {
    const prompt = buildFixPrompt([f]);

    // The CLI no longer re-scans; the agent has to check its own work, and it
    // needs a command that works in any project, not this repo's local build.
    expect(prompt).toContain('npx @api-doctor/cli@latest .');
    expect(prompt).toContain(VERIFY_COMMAND);
    expect(prompt).toContain('Keep going until the errors above are gone');
    expect(prompt).toContain('no new ones have appeared');
    expect(prompt).toContain('is not evidence');
  });

  it('no longer claims api-doctor will re-run by itself', () => {
    expect(buildFixPrompt([f])).not.toContain('api-doctor re-runs automatically');
  });

  it('forbids committing, so the developer reviews the diff themselves', () => {
    const prompt = buildFixPrompt([f]);

    expect(prompt).toContain('Do NOT commit, stage, or push anything');
    expect(prompt).toContain('git commit');
    expect(prompt).toContain('uncommitted in the working tree');
  });

  it('asks for a per-file reason, since that summary replaces the commit message', () => {
    const prompt = buildFixPrompt([f]);

    expect(prompt).toContain('one line per file you changed');
    expect(prompt).toContain('what you changed and why');
  });
});

describe('describeRetrigger', () => {
  it('omits the argument for the default directory', () => {
    expect(describeRetrigger('.').join('\n')).toContain('api-doctor --fix');
    expect(describeRetrigger('.').join('\n')).not.toContain('--fix .');
  });

  it('passes a plain path through unquoted', () => {
    expect(describeRetrigger('src/app').join('\n')).toContain('api-doctor --fix src/app');
  });

  it('quotes a path containing spaces so the command is runnable as printed', () => {
    const text = describeRetrigger('/Users/me/qualty documents/app').join('\n');

    expect(text).toContain("api-doctor --fix '/Users/me/qualty documents/app'");
  });

  it('escapes an embedded single quote', () => {
    expect(describeRetrigger("/tmp/it's here").join('\n')).toContain("'/tmp/it'\\''s here'");
  });
});

describe('describeSessionEnd', () => {
  it('points the human at the diff and the re-check command', () => {
    const text = describeSessionEnd().join('\n');

    expect(text).toContain('uncommitted');
    expect(text).toContain(VERIFY_COMMAND);
  });

  it('never claims api-doctor verified anything — this run did not re-scan', () => {
    const text = describeSessionEnd().join('\n');

    expect(text).not.toContain('verified');
    expect(text).not.toContain('re-scan');
  });
});

describe('the agent menu', () => {
  const agents = FIX_AGENTS.map((agent, i) => ({ ...agent, available: i === 1 }));

  it('offers every agent plus an explicit way out', () => {
    const menu = buildAgentMenu(agents);

    expect(menu.map((i) => i.value)).toEqual(['claude', 'cursor', 'codex', 'skip']);
  });

  it('names an agent that is not installed instead of hiding the row', () => {
    const menu = buildAgentMenu(agents);

    expect(menu[0]?.hint).toBe('not installed');
    expect(menu[1]?.hint).toBeUndefined();
  });

  it('opens on the first installed agent', () => {
    expect(defaultAgentIndex(agents)).toBe(1);
  });

  it('falls back to the first row when nothing is installed', () => {
    expect(defaultAgentIndex(agents.map((a) => ({ ...a, available: false })))).toBe(0);
  });

  it('sends a bare --fix to the agent that is actually installed', () => {
    expect(defaultFixAgent(agents).id).toBe('cursor');
  });

  it('still names an agent when none are installed, so the message is concrete', () => {
    const none = agents.map((a) => ({ ...a, available: false }));

    expect(defaultFixAgent(none).id).toBe('claude');
  });

  it('resolves the ids the menu and --fix both use', () => {
    expect(agentById('codex')?.command).toBe('codex');
    expect(agentById('skip')).toBeUndefined();
  });
});

describe('isOnPath', () => {
  it('finds an executable that exists in a PATH directory', () => {
    // `node` is running this test, so its directory is on PATH by construction.
    expect(isOnPath('node')).toBe(true);
  });

  it('reports a missing binary rather than throwing on unreadable entries', () => {
    const env = { PATH: ['/definitely/not/here', '/usr/bin'].join(':') };

    expect(isOnPath('api-doctor-does-not-exist', env)).toBe(false);
  });
});

describe('describeHandoff', () => {
  const claude = FIX_AGENTS[0]!;

  it('says the prompt is on the clipboard and that nothing is submitted', () => {
    const text = describeHandoff(claude, true).join('\n');

    expect(text).toContain('copied to your clipboard');
    expect(text).toContain('Claude Code');
    expect(text).toContain('Nothing is submitted for you');
  });

  it('offers the slash command on agents that read the installed skill', () => {
    const claudeText = describeHandoff(claude, true).join('\n');
    expect(claudeText).toContain('/api-doctor');

    // Codex discovers skills by description rather than a slash command, so
    // naming one there would be an instruction that does not work.
    const codex = FIX_AGENTS.find((a) => a.id === 'codex')!;
    expect(codex.readsSkill).toBe(false);
    expect(describeHandoff(codex, true).join('\n')).not.toContain('/api-doctor');
  });

  it('never claims the session is already opening', () => {
    // The gate holds the terminal until a keypress, so the copy has to read as
    // an instruction for what is about to happen, not a description of it.
    const text = describeHandoff(claude, true).join('\n');
    expect(text).not.toContain('opening Claude Code');
    expect(describeLaunchGate(claude)).toContain('Press any key');
    expect(describeLaunchGate(claude)).toContain('Claude Code');
  });

  it('falls back to the printed prompt when the clipboard is unreachable', () => {
    const text = describeHandoff(claude, false).join('\n');

    expect(text).toContain('could not reach your clipboard');
    expect(text).toContain('Copy it');
    expect(text).not.toContain('Nothing is submitted for you');
  });
});

describe('describeMissingAgent', () => {
  it('names the binary, where to get it, and how to fix without it', () => {
    const text = describeMissingAgent(FIX_AGENTS[1]!).join('\n');

    expect(text).toContain('`cursor-agent` was not found on PATH');
    expect(text).toContain('https://cursor.com/cli');
    expect(text).toContain('--fix-dry-run');
  });
});

describe('describeNothingToFix', () => {
  it('says nothing to fix only when there is genuinely nothing', () => {
    expect(describeNothingToFix(0).join('\n')).toBe('api-doctor: no findings — nothing to fix.');
  });

  it('names the findings it cannot handle instead of implying a clean project', () => {
    const text = describeNothingToFix(8).join('\n');

    expect(text).toContain('8 finding(s) were reported, all warnings or info');
    expect(text).toContain('errors only');
    // The old wording claimed a clean bill of health over 8 real findings.
    expect(text).not.toContain('nothing to fix.');
  });
});
