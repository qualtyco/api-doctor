import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { CoverageCollection, DetectedProvider, ScanResult } from './types.js';
import {
  aggregateAiAuthors,
  detectAgentSignals,
  resolveAiModel,
  sanitizeModelSlug,
} from './agent-detector.js';
import { readProjectHistory, writeProjectHistory } from './run-history.js';
import { getRuleDocsMeta } from './plugin/rule-registry.js';
import { resolveInstalledVersion } from './plugin/installed-version.js';
import { compatProviders, symbolFromMessage } from './providers/index.js';

// Public project API key — safe to embed (same as a browser-side PostHog key).
const POSTHOG_API_KEY = 'phc_odgcBBsio9P5XJ3zT3Hyd6pgawQXW6YvwgJUejUTWhxz';
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/capture/';

// install-id stays global (per-user); run history moves to each project dir.
const INSTALL_ID_PATH = join(homedir(), '.api-doctor', 'install-id');

/** Privacy-safe stable identifier for a scanned project directory. */
export function hashProjectDir(projectDir: string): string {
  return createHash('sha256').update(resolve(projectDir)).digest('hex');
}

function isTelemetryDisabled(noTelemetry: boolean): boolean {
  if (noTelemetry) return true;
  if (process.env['DO_NOT_TRACK'] === '1') return true;
  if (process.env['API_DOCTOR_TELEMETRY'] === '0') return true;
  return false;
}

function getOrCreateInstallId(): string {
  try {
    mkdirSync(join(homedir(), '.api-doctor'), { recursive: true });
    if (existsSync(INSTALL_ID_PATH)) {
      return readFileSync(INSTALL_ID_PATH, 'utf-8').trim();
    }
    const id = randomUUID();
    writeFileSync(INSTALL_ID_PATH, id, 'utf-8');
    return id;
  } catch {
    return 'anonymous';
  }
}

/**
 * How this run was triggered — a single axis with three buckets:
 *   ci    — the Qualty API Doctor GitHub App (runs in GitHub Actions)
 *   agent — a local coding agent (Claude Code, Cursor, Codex, Windsurf)
 *   local — a developer ran the CLI by hand in their terminal
 *
 * CI is checked first and wins deliberately: the GitHub App runs inside GitHub
 * Actions where CI=true, and that must take precedence even if a coding-agent
 * env var also happens to be present on the runner. Any other CI provider also
 * reports 'ci' — we treat the App and generic CI as the same bucket on purpose.
 * The GITHUB_WORKFLOW clause is belt-and-suspenders: it keeps the App in 'ci'
 * even in the edge case where CI is unset, and names the App explicitly in code.
 */
function detectRunContext(): string {
  if (
    process.env['CI'] ||
    (process.env['GITHUB_ACTIONS'] === 'true' && process.env['GITHUB_WORKFLOW'] === 'API Doctor Scan')
  )
    return 'ci';
  if (
    process.env['CLAUDECODE'] ||
    process.env['CURSOR_TRACE_ID'] ||
    process.env['CODEX_ENV'] ||
    process.env['WINDSURF_SESSION_ID']
  )
    return 'agent';
  return 'local';
}

async function capture(event: string, distinctId: string, properties: Record<string, unknown>): Promise<void> {
  await fetch(POSTHOG_CAPTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_API_KEY, event, distinct_id: distinctId, properties }),
  });
}

function sanitizeErrorText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const home = homedir();
  let sanitized = text;
  if (home) sanitized = sanitized.split(home).join('[home]');
  sanitized = sanitized.replace(/\/[\w.@+~-]+(?:\/[\w.@+~-]+)+/g, '[path]');
  sanitized = sanitized.replace(/[A-Za-z]:\\(?:[^\\\n]+\\)*[^\\\n]*/g, '[path]');
  return sanitized;
}

export interface TrackRunOptions {
  version: string;
  results: ScanResult[];
  detected: DetectedProvider[];
  score: number;
  durationMs: number;
  noTelemetry: boolean;
  projectDir: string;
  /** Number of source files walked — lets us tell empty/unscannable dirs apart from real passes. */
  filesScanned: number;
  /** Self-reported model id from `--agent-model` / API_DOCTOR_AGENT_MODEL — set by agents running the scan. */
  agentModel?: string;
  /** Informational SDK usage per provider; sdk_used/unknown_sdk_calls on provider_scanned. */
  coverage?: CoverageCollection[];
}

/**
 * Coverage props for a provider_scanned event. Privacy holds by construction:
 * `sdk_used` is a closed vocabulary from the hand-written surface manifest,
 * and `unknown_sdk_calls` is a bare count — no code, method names outside the
 * manifest, file paths, or arguments ever leave the machine. Returns {} when
 * coverage did not run for the provider, so analytics can tell "didn't run"
 * apart from "ran, nothing used" (empty array). unknown_sdk_calls keeps
 * undercounting visible: absence of a method in the data can mean "unused" or
 * "undetectable", and this is the signal that separates the two.
 */
export function coverageTelemetryProps(
  providerName: string,
  entry: CoverageCollection | undefined,
): Record<string, string[] | number> {
  if (!entry) return {};
  return {
    sdk_used: entry.used.map((m) => `${providerName}.${m}`),
    unknown_sdk_calls: entry.unknownSdkCalls,
  };
}

/**
 * Compatibility telemetry for a cli_run event. The class exists to answer one
 * question — do developers act on "this symbol doesn't exist in your installed
 * version"? — so alongside the counts it reports which symbols disappeared
 * since the previous run (fix rate falls out of run-history). Privacy holds by
 * construction: `symbols` is intersected with the closed vocabulary of the
 * hand-written compat manifests, so only listed symbol names ever leave the
 * machine, and the installed version is resolved locally from the project.
 */
export function compatTelemetry(
  results: ScanResult[],
  detected: DetectedProvider[],
  projectDir: string,
  prevSymbols: string[] | undefined,
): { props: Record<string, unknown>; symbols: string[] } {
  const compatResults = results.filter(
    (r) =>
      getRuleDocsMeta(r.ruleKey)?.category === 'compatibility' &&
      (r.severity === 'error' || r.severity === 'warning'),
  );
  // The rendered message starts with the symbol name; the registry's closed
  // vocabulary drops anything else.
  const symbols = [
    ...new Set(compatResults.map((r) => symbolFromMessage(r.message)).filter((s) => s !== null)),
  ].sort();
  const fixedSinceLastRun = (prevSymbols ?? []).filter((s) => !symbols.includes(s)).length;
  // Whichever compat-tracked provider this project actually has. Read from the
  // manifests rather than naming one provider, so a second provider gaining a
  // compatibility.ts is a data change and not an edit here. First detected
  // wins: the prop is one version, and a project with two compat providers is
  // not a case worth widening the schema for.
  const compatPackage = compatProviders.find((p) => detected.some((d) => d.name === p.name))
    ?.compatibility?.package;
  const installedVersion = compatPackage
    ? resolveInstalledVersion(join(projectDir, 'package.json'), compatPackage)
    : null;

  return {
    props: {
      compat_findings: compatResults.length,
      compat_symbols: symbols,
      compat_fixed_since_last_run: fixedSinceLastRun,
      // Omitted (not null) when no compat-tracked provider is detected or the
      // version cannot be resolved — "unknown" and "not applicable" stay apart.
      ...(installedVersion ? { compat_installed_version: installedVersion } : {}),
    },
    symbols,
  };
}

export async function trackRun(opts: TrackRunOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    const prev = readProjectHistory(opts.projectDir);
    const scoreDelta = prev !== null ? opts.score - prev.last_score : null;

    // All detection signals (config markers, git trailers, local agent session
    // state, --agent-model) collapse into one answer per event: ai_model, the
    // model (or agent) that made the code, plus ai_model_source saying which
    // signal decided it. Only that resolved slug leaves the machine — never
    // author names, emails, file paths, or session content.
    const agentSignals = await detectAgentSignals(opts.projectDir);
    const repoAiAuthors = aggregateAiAuthors(agentSignals.commits);
    const selfReportedModel = opts.agentModel ? sanitizeModelSlug(opts.agentModel) : null;
    const repoAiModel = resolveAiModel(
      repoAiAuthors,
      agentSignals.sessions,
      selfReportedModel,
      agentSignals.configMarkers,
    );

    const sharedProps = {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      run_context: detectRunContext(),
    };

    const compat = compatTelemetry(
      opts.results,
      opts.detected,
      opts.projectDir,
      prev?.compat_symbols,
    );

    // 1. Summary event.
    await capture('cli_run', distinctId, {
      ...sharedProps,
      project_hash: hashProjectDir(opts.projectDir),
      score: opts.score,
      score_delta: scoreDelta,
      // A score of 100 with zero providers detected is a no-op scan, not a
      // healthy integration — segment on these to keep the two apart.
      providers_detected: opts.detected.length,
      files_scanned: opts.filesScanned,
      errors: opts.results.filter((r) => r.severity === 'error').length,
      warnings: opts.results.filter((r) => r.severity === 'warning').length,
      duration_ms: Math.round(opts.durationMs),
      run_count: (prev?.run_count ?? 0) + 1,
      ai_model: repoAiModel.model,
      ai_model_source: repoAiModel.source,
      ...compat.props,
    });

    // 2. One event per detected provider.
    await Promise.all(
      opts.detected.map((d) => {
        const rules_triggered = [
          ...new Set(
            opts.results
              .filter((r) => r.ruleKey.startsWith(d.name) && (r.severity === 'error' || r.severity === 'warning'))
              .map((r) => r.ruleKey),
          ),
        ];
        // Git evidence scoped to the commits that touched this provider's
        // files is the strongest answer; when those commits carry no AI
        // signature the resolver falls back to self-report, sessions, and
        // config markers, which exist even when humans make every commit.
        const scopedAuthors = d.files?.length
          ? aggregateAiAuthors(agentSignals.commits, d.files)
          : [];
        const aiModel = resolveAiModel(
          scopedAuthors,
          agentSignals.sessions,
          selfReportedModel,
          agentSignals.configMarkers,
        );
        return capture('provider_scanned', distinctId, {
          ...sharedProps,
          provider: d.name,
          score: opts.score,
          rules_triggered,
          ai_model: aiModel.model,
          ai_model_source: aiModel.source,
          ...coverageTelemetryProps(d.name, opts.coverage?.find((c) => c.provider === d.name)),
        });
      }),
    );

    writeProjectHistory(opts.projectDir, {
      last_score: opts.score,
      last_run: new Date().toISOString(),
      run_count: (prev?.run_count ?? 0) + 1,
      compat_symbols: compat.symbols,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}

export interface TrackFixOptions {
  version: string;
  /** Providers whose findings were handed to the agent — names only. */
  providers: string[];
  /** Errors the prompt targeted. */
  targeted: number;
  /** False when the chosen agent's binary was not found on PATH. */
  launched: boolean;
  /** Which agent the user picked from the menu — the id only (claude|cursor|codex). */
  agent?: string;
  dryRun: boolean;
  noTelemetry: boolean;
}

/**
 * Records how well an agent-driven fix actually held up against the rules.
 * `remaining` and `introduced` are the honest signals here: a rule the agent
 * routinely cannot satisfy is a rule that is too narrow, and that is worth
 * knowing.
 */
export async function trackFix(opts: TrackFixOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    await capture('fix_command_run', distinctId, {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      providers: opts.providers,
      findings_targeted: opts.targeted,
      agent_launched: opts.launched,
      agent: opts.agent,
      dry_run: opts.dryRun,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}

export async function trackError(err: unknown, noTelemetry: boolean, version: string): Promise<void> {
  if (isTelemetryDisabled(noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    await capture('cli_error', distinctId, {
      cli_version: version,
      node_version: process.version,
      platform: process.platform,
      error_message: sanitizeErrorText(err instanceof Error ? err.message : String(err)),
      stack_trace: sanitizeErrorText(err instanceof Error ? err.stack : undefined),
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}
