/**
 * The fix phase of `api-doctor` — hands the errors it found to the user's own
 * coding agent.
 *
 * It is part of the default command rather than a separate one: a scan that
 * stops at a list of problems leaves the user to discover a second command, so
 * the offer follows the report in the same run.
 *
 * The handoff is a paste, not a submit. api-doctor opens the agent the user
 * chose in the scanned directory and puts the prompt on the clipboard — the
 * developer reads it, edits it if they want, and presses enter themselves.
 * Nothing starts running behind them.
 *
 * **Verification lives in the prompt, not in this process.** api-doctor exits
 * once the session is over; the agent is told to re-run `npx
 * @api-doctor/cli@latest .` itself and keep going until the scan is clean. The
 * loop is still AST → agent → AST — deterministic rules locate the problem and
 * the same deterministic rules decide whether the rewrite counts, because an
 * agent's own report that it fixed something is not evidence — but the agent
 * drives it, inside the session where it can act on the answer.
 *
 * The prompt deliberately carries only what a human would be told: the rendered
 * finding message, the manifest's fix guidance, and a docs link. It never
 * describes what the rule matches on. Handing an agent the matcher's shape
 * teaches it to satisfy the matcher rather than the requirement, which is the
 * failure mode this command exists to avoid — so the pass condition stays
 * behavioural (the rule stops firing, and nothing else starts) rather than
 * textual (the code looks like some expected snippet).
 */
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Finding, Report } from './types.js';

/** How the agent is told to re-check its own work. Pinned to @latest on purpose. */
export const VERIFY_COMMAND = 'npx @api-doctor/cli@latest .';

/**
 * Findings handed to the agent: every error, in any category.
 *
 * Errors are the findings api-doctor is willing to fail a build over, which
 * makes them the ones worth a session. Warnings and info are advisory — sweeping
 * them into the same prompt would bury the errors and invite churn in code that
 * is working. The agent verifies behaviourally by re-running the scan, so
 * nothing here depends on a category carrying a verified replacement.
 */
export function filterFixableFindings(report: Report): Finding[] {
  return report.findings.filter((f) => f.severity === 'error');
}

/**
 * What to say when there is nothing for the fix phase to act on. Reporting
 * "nothing to fix" while the scan found issues it simply does not handle would
 * be a lie of omission, so the other findings are named explicitly.
 */
export function describeNothingToFix(totalFindings: number): string[] {
  if (totalFindings === 0) return ['api-doctor: no findings — nothing to fix.'];
  return [
    'api-doctor: no errors to fix.',
    `  ${totalFindings} finding(s) were reported, all warnings or info. \`--fix\` hands over`,
    '  errors only — the findings serious enough to fail a build.',
    '  Run `api-doctor install` to have your coding agent work through the rest.',
  ];
}

/** What the fix phase should do once the scan has been reported. */
export type FixMode = 'skip' | 'ask' | 'run' | 'dry-run';

/**
 * Resolves the fix phase's behaviour from the flags and the terminal.
 *
 * `--no-fix` always wins, because CI needs one flag that guarantees the run
 * never blocks on a prompt. Otherwise an explicit `--fix` runs unattended, and
 * everything else only offers where there is a terminal to answer on — a
 * structured-output run is being piped somewhere, and a non-interactive one has
 * nobody to ask.
 */
export function resolveFixMode(input: {
  /** `--fix`, `--fix <agent>`, `--no-fix`, or nothing. */
  requested?: boolean | string;
  dryRun: boolean;
  structuredOutput: boolean;
  interactive: boolean;
}): FixMode {
  if (input.requested === false) return 'skip';
  if (input.dryRun) return 'dry-run';
  if (input.requested) return 'run';
  if (input.structuredOutput || !input.interactive) return 'skip';
  return 'ask';
}

/**
 * Builds the prompt handed to the agent. Pure and exported so its contents are
 * asserted in tests rather than reviewed by eye.
 *
 * When the run wrote a report file, the prompt is a one-line-per-error index
 * and a pointer to that JSON — the agent reads structured data instead of
 * parsing paragraphs, and the developer pasting it can still see the whole list
 * at a glance. Only when there is no report file (`--no-report`) does every
 * finding's guidance and docs link get inlined, because then the prompt is the
 * only copy.
 */
export function buildFixPrompt(findings: Finding[], reportPath?: string): string {
  const lines: string[] = [];
  lines.push(
    `api-doctor found ${findings.length} ${findings.length === 1 ? 'error' : 'errors'} in this project's API integrations.`,
    'These come from deterministic checks over your source, not from a model — each one',
    'names a real call site.',
    '',
  );

  if (reportPath) {
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.location.file}:${f.location.line} — ${f.message}`);
    });
    lines.push(
      '',
      `Read \`${reportPath}\` first. It is the full report for this scan: every finding`,
      'above with its fix guidance, a docs link, the offending code snippet, and the',
      'category and severity. Work from that file rather than from this summary.',
      'It also lists warnings and info — those are not part of this task; the errors',
      'listed above are.',
      '',
    );
  } else {
    lines.push('Fix each one:', '');
    findings.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.location.file}:${f.location.line}`);
      lines.push(`   Problem: ${f.message}`);
      if (f.fix) lines.push(`   Guidance: ${f.fix}`);
      if (f.docsUrl) lines.push(`   Docs: ${f.docsUrl}`);
      lines.push('');
    });
  }

  lines.push(
    'How to approach this:',
    '- Keep the surrounding business logic, variable names, and code style as they are.',
    '  Change only what the finding actually requires.',
    '- Write whatever is idiomatic for this codebase. There is no single expected shape —',
    '  any correct use of the API is fine.',
    '- Do not silence the check: no suppression comments, no renaming to dodge it, no',
    '  deleting the call. Fix the real integration.',
    '- If one of these looks wrong for this codebase, say so instead of forcing it.',
    '',
    'Verify your own work before you finish:',
    '',
    `  ${VERIFY_COMMAND}`,
    '',
    'Run that after your edits. It re-runs the same checks and prints what is left.',
    'Keep going until the errors above are gone and no new ones have appeared — a fix',
    'that clears one error while introducing another is not done. Your own account of',
    'what you changed is not evidence; that command is.',
    '',
    'Do NOT commit, stage, or push anything. Do not run `git commit`, `git add`, or',
    '`git push`. Leave every change uncommitted in the working tree so the developer',
    'can review the diff themselves.',
    '',
    'Then print a short summary — one line per file you changed, saying',
    'what you changed and why. One sentence each, no preamble. That summary is what',
    'the developer reads before reviewing the diff, so it has to stand on its own.',
  );
  return lines.join('\n');
}

/** Shell-quotes a path only when it needs it (these paths often contain spaces). */
function shellArg(value: string): string {
  return /^[\w./@-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * How to start the handoff later. Printed when the user skips, and when we
 * cannot ask at all (no TTY — CI, piped output), so the run still ends at a
 * runnable command rather than a dead end.
 */
export function describeRetrigger(directory: string): string[] {
  const target = directory === '.' ? '' : ` ${shellArg(directory)}`;
  return ['', 'To hand these to an agent:', `  api-doctor --fix${target}`];
}

/**
 * Printed when the agent session exits.
 *
 * api-doctor does not re-scan here — the prompt told the agent to verify itself,
 * inside the session where it can still act on the result. This line is for the
 * human, who now wants to read the diff and see the score.
 */
export function describeSessionEnd(): string[] {
  return [
    '',
    'api-doctor: session closed. Your changes are uncommitted — review the diff.',
    `  To re-check the project yourself:  ${VERIFY_COMMAND}`,
  ];
}

/** How this platform's terminal pastes. */
function pasteShortcut(): string {
  if (process.platform === 'darwin') return '⌘V';
  if (process.platform === 'win32') return 'Ctrl+V';
  return 'Ctrl+Shift+V';
}

/**
 * What to say as the session opens.
 *
 * The prompt is handed over by paste on purpose — the developer sees exactly
 * what their agent is about to be told, and decides when it runs. Saying so
 * matters: an agent window that opens by itself otherwise reads as one that has
 * already started working.
 */
export function describeHandoff(agent: FixAgent, copied: boolean): string[] {
  if (!copied) {
    return [
      '',
      `api-doctor: could not reach your clipboard — the prompt is above.`,
      `  Copy it, then paste it into ${agent.label} and press enter.`,
      '',
    ];
  }
  const lines = [
    '',
    'api-doctor: prompt copied to your clipboard.',
    '',
    `  Once ${agent.label} opens, paste it with ${pasteShortcut()} and press enter.`,
  ];
  // The skill is already in the project by now, so on agents that read it
  // there is a route that needs no clipboard at all.
  if (agent.readsSkill) lines.push('  Or just type /api-doctor — the skill is installed.');
  lines.push('', '  Nothing is submitted for you.', '');
  return lines;
}

/** Shown while the terminal is held, immediately before the agent takes it. */
export function describeLaunchGate(agent: FixAgent): string {
  return `  Press any key to open ${agent.label}…`;
}

/** Said when the chosen agent's CLI turns out not to be installed. */
export function describeMissingAgent(agent: FixAgent): string[] {
  return [
    `api-doctor: \`${agent.command}\` was not found on PATH.`,
    `  Install ${agent.label} (${agent.installUrl}), or run \`api-doctor --fix-dry-run\``,
    '  and paste the prompt into any agent.',
  ];
}

/**
 * The menu shown after a scan that found something fixable.
 *
 * Every agent is listed whether or not it is installed: a missing one is
 * information ("Codex would work here, you don't have it"), and hiding rows
 * would make the menu's contents depend on the machine.
 */
export function buildAgentMenu(
  agents: (FixAgent & { available: boolean })[],
): { value: string; label: string; hint?: string }[] {
  const items = agents.map((agent) => ({
    value: agent.id,
    label: agent.label,
    hint: agent.available ? undefined : 'not installed',
  }));
  return [...items, { value: 'skip', label: 'Skip for now' }];
}

/** Index of the row the menu opens on: the first installed agent, else the first row. */
export function defaultAgentIndex(agents: (FixAgent & { available: boolean })[]): number {
  const index = agents.findIndex((agent) => agent.available);
  return index === -1 ? 0 : index;
}

/**
 * Agent for a bare `--fix`, which says "use whatever I have" rather than naming
 * one: the first installed, falling back to the head of the list so the missing
 * -agent message still names something concrete.
 */
export function defaultFixAgent(agents = detectFixAgents()): FixAgent {
  return agents.find((agent) => agent.available) ?? FIX_AGENTS[0]!;
}

/** A coding agent CLI api-doctor can open on the findings. */
export interface FixAgent {
  /** Stable id, also what `--fix <agent>` accepts. */
  id: string;
  label: string;
  /** Executable looked up on PATH. */
  command: string;
  /** Arguments that open an interactive session with an empty input. */
  args: string[];
  installUrl: string;
  /**
   * True when this agent discovers the skill a scan installs, so `/api-doctor`
   * is a second way in that needs no clipboard at all. Set from where each
   * agent actually reads skills from — never assumed.
   */
  readsSkill: boolean;
}

/**
 * The agents offered after a scan, in menu order.
 *
 * Every entry opens a normal interactive session in the current directory with
 * no prompt argument and no bypass flags — api-doctor is a launcher, not an
 * autonomous agent, and the prompt arrives by paste.
 */
export const FIX_AGENTS: FixAgent[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    command: 'claude',
    args: [],
    installUrl: 'https://claude.com/claude-code',
    // Reads .claude/skills/ only — which is why a scan links it there.
    readsSkill: true,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    command: 'cursor-agent',
    args: [],
    installUrl: 'https://cursor.com/cli',
    // Reads .agents/skills/ and .claude/skills/ both.
    readsSkill: true,
  },
  {
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    args: [],
    installUrl: 'https://developers.openai.com/codex/cli',
    // Discovers .agents/skills/, but invocation is by description, not a
    // slash command — so the paste stays the instruction we give.
    readsSkill: false,
  },
];

export function agentById(id: string): FixAgent | undefined {
  return FIX_AGENTS.find((a) => a.id === id);
}

/**
 * Whether an executable exists on PATH. Read off the filesystem rather than by
 * spawning `which`: this runs for every agent on every scan that finds
 * something, and a probe process each is a cost the user can feel.
 */
export function isOnPath(command: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const search = env['PATH'] ?? '';
  const extensions =
    process.platform === 'win32'
      ? (env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';')
      : [''];
  for (const dir of search.split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      try {
        if (statSync(join(dir, command + ext)).isFile()) return true;
      } catch {
        // Unreadable PATH entry — not an error, just not a match.
      }
    }
  }
  return false;
}

/** The agents, each marked with whether its CLI is actually installed. */
export function detectFixAgents(): (FixAgent & { available: boolean })[] {
  return FIX_AGENTS.map((agent) => ({ ...agent, available: isOnPath(agent.command) }));
}

export interface LaunchResult {
  /** False when the agent's binary is not on PATH. */
  launched: boolean;
  /** Exit code of the agent session, when it ran. */
  code?: number;
}

/**
 * Opens the chosen agent interactively in `cwd`, inheriting the terminal so the
 * session behaves exactly as if the user had started it themselves — same tool
 * approvals, no prompt argument, no bypass flags.
 */
export function launchAgent(agent: FixAgent, cwd: string): Promise<LaunchResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(agent.command, agent.args, { cwd, stdio: 'inherit' });
    child.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'ENOENT') resolvePromise({ launched: false });
      else reject(err);
    });
    child.on('close', (code: number | null) => resolvePromise({ launched: true, code: code ?? 0 }));
  });
}
