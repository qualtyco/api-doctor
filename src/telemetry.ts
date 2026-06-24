import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DetectedProvider, ScanResult } from './types.js';
import { readProjectHistory, writeProjectHistory } from './run-history.js';

// Public project API key — safe to embed (same as a browser-side PostHog key).
const POSTHOG_API_KEY = 'phc_odgcBBsio9P5XJ3zT3Hyd6pgawQXW6YvwgJUejUTWhxz';
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/capture/';

// install-id stays global (per-user); run history moves to each project dir.
const INSTALL_ID_PATH = join(homedir(), '.api-doctor', 'install-id');


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

function detectRunContext(): string {
  if (process.env['CI']) return 'ci';
  if (
    process.env['CLAUDE_CODE'] ||
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

export interface TrackRunOptions {
  version: string;
  results: ScanResult[];
  detected: DetectedProvider[];
  rawPackages: string[];
  score: number;
  durationMs: number;
  noTelemetry: boolean;
  projectDir: string;
}

export async function trackRun(opts: TrackRunOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    const prev = readProjectHistory(opts.projectDir);
    const scoreDelta = prev !== null ? opts.score - prev.last_score : null;

    const sharedProps = {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      run_context: detectRunContext(),
    };

    // 1. Summary event.
    await capture('cli_run', distinctId, {
      ...sharedProps,
      score: opts.score,
      score_delta: scoreDelta,
      errors: opts.results.filter((r) => r.severity === 'error').length,
      warnings: opts.results.filter((r) => r.severity === 'warning').length,
      duration_ms: Math.round(opts.durationMs),
      run_count: (prev?.run_count ?? 0) + 1,
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
        return capture('provider_scanned', distinctId, {
          ...sharedProps,
          provider: d.name,
          score: opts.score,
          rules_triggered,
        });
      }),
    );

    // 3. One event per package in the project.
    await Promise.all(
      opts.rawPackages.map((pkg) =>
        capture('package_seen', distinctId, { ...sharedProps, package: pkg }),
      ),
    );

    writeProjectHistory(opts.projectDir, {
      last_score: opts.score,
      last_run: new Date().toISOString(),
      run_count: (prev?.run_count ?? 0) + 1,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}

export interface TrackInstallOptions {
  version: string;
  filesCreated: number;
  filesUpdated: number;
  filesSkipped: number;
  force: boolean;
  noTelemetry: boolean;
}

export async function trackInstall(opts: TrackInstallOptions): Promise<void> {
  if (isTelemetryDisabled(opts.noTelemetry)) return;

  try {
    const distinctId = getOrCreateInstallId();
    await capture('install_command_run', distinctId, {
      cli_version: opts.version,
      node_version: process.version,
      platform: process.platform,
      files_created: opts.filesCreated,
      files_updated: opts.filesUpdated,
      files_skipped: opts.filesSkipped,
      force: opts.force,
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
      error_message: err instanceof Error ? err.message : String(err),
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
  } catch {
    // Never surface telemetry errors to the user.
  }
}
