import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repoRoot, 'dist/cli.mjs');

// RULE-DISABLED 2026-07-28: was resend-api-key-hardcoded-broken, but that rule
// is commented out in the resend manifest pre-launch and it was the only
// error-severity finding on that fixture — leaving it here would have made
// "exits 1 when errors are found" silently assert nothing. Repointed at a
// fixture that still produces an error. Both are equally valid for the other
// three usages below, which only need at least one finding.
const ERROR_FIXTURE = join(repoRoot, 'tests/fixtures/resend/resend-api-key-in-client-bundle-broken');
const WARNING_FIXTURE = join(
  repoRoot,
  'tests/fixtures/resend/resend-missing-idempotency-key-broken',
);

function run(args: string[]) {
  return spawnSync('node', [cli, ...args], { encoding: 'utf8' });
}

describe('cli output modes', () => {
  it('--format json emits clean parseable JSON to stdout', () => {
    const res = run([ERROR_FIXTURE, '--format', 'json', '--no-report']);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.schemaVersion).toBe('1.1.0');
    expect(parsed.findings.length).toBeGreaterThan(0);
    // No human output should leak into the stream.
    expect(res.stdout).not.toContain('Detected APIs');
  });

  it('--format markdown emits the document and the agent handoff prompt', () => {
    const res = run([ERROR_FIXTURE, '--format', 'markdown', '--no-report']);
    expect(res.stdout).toContain('# api-doctor report');
    expect(res.stdout).toContain('## How to fix these with a coding agent');
    expect(res.stdout).toContain('Process them in order');
  });

  it('--quiet prints only the score line', () => {
    const res = run([WARNING_FIXTURE, '--quiet', '--no-report']);
    expect(res.stdout.trim()).toMatch(/^Score: \d+\/100$/);
    expect(res.stdout).not.toContain('install');
  });

  it('suggests install after a default scan when the agent skill is missing', () => {
    const res = run([ERROR_FIXTURE, '--no-report']);
    expect(res.stdout).toContain('npx @api-doctor/cli install');
  });
});

describe('cli exit codes', () => {
  it('exits 1 when errors are found', () => {
    const res = run([ERROR_FIXTURE, '--no-report', '--quiet']);
    expect(res.status).toBe(1);
  });

  it('exits 0 for warnings with no --max-warnings', () => {
    const res = run([WARNING_FIXTURE, '--no-report', '--quiet']);
    expect(res.status).toBe(0);
  });

  it('exits 1 when warnings exceed --max-warnings', () => {
    const res = run([WARNING_FIXTURE, '--max-warnings', '0', '--no-report', '--quiet']);
    expect(res.status).toBe(1);
  });

  it('exits 2 on a tool-level failure (unreadable directory)', () => {
    const res = run([join(repoRoot, 'no-such-dir-xyz'), '--no-report', '--quiet']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Could not read directory');
  });

  it('exits 2 on an invalid --format value', () => {
    const res = run([WARNING_FIXTURE, '--format', 'xml', '--no-report']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('unknown --format');
  });
});
