import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/reporter/report-builder.js';
import { renderMarkdown } from '../../src/reporter/markdown.js';
import type { CoverageCollection, DetectedProvider } from '../../src/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repoRoot, 'dist/cli.mjs');

const detected: DetectedProvider[] = [{ name: 'resend', source: 'imports', checked: true }];

const coverage: CoverageCollection[] = [
  {
    provider: 'resend',
    used: ['batch.send', 'emails.send'],
    unknownSdkCalls: 3,
  },
];

function build(withCoverage: boolean) {
  return buildReport({
    results: [],
    detected,
    directory: '/repo',
    filesScanned: 1,
    filesContent: new Map(),
    durationMs: 5,
    version: '9.9.9',
    coverage: withCoverage ? coverage : undefined,
  });
}

describe('report coverage section', () => {
  it('embeds coverage as a top-level section without touching the summary', () => {
    const withCoverage = build(true);
    const without = build(false);
    expect(withCoverage.coverage).toEqual([{ provider: 'resend', used: coverage[0].used }]);
    expect(withCoverage.summary).toEqual(without.summary);
    expect(withCoverage.findings).toEqual(without.findings);
  });

  it('strips collection diagnostics — the report carries no counts', () => {
    const entry = build(true).coverage?.[0] as Record<string, unknown>;
    expect('unknownSdkCalls' in entry).toBe(false);
  });

  it('omits the coverage key entirely when nothing qualifies', () => {
    expect('coverage' in build(false)).toBe(false);
  });

  // A provider can be collected and resolve nothing (unverifiable wrapper,
  // raw fetch). That entry still reaches telemetry, but carries nothing for a
  // reader, so the report must omit it rather than emit an empty section.
  it('omits entries with no verified usage instead of emitting an empty section', () => {
    const report = buildReport({
      results: [],
      detected,
      directory: '/repo',
      filesScanned: 1,
      filesContent: new Map(),
      durationMs: 5,
      version: '9.9.9',
      coverage: [{ provider: 'resend', used: [], unknownSdkCalls: 4 }],
    });
    expect('coverage' in report).toBe(false);
    expect(renderMarkdown(report)).not.toContain('SDK surface');
  });

  it('never mentions counts or ratios of surface usage', () => {
    const json = JSON.stringify(build(true).coverage);
    expect(json).not.toMatch(/available|unused|percent|ratio|\d+ of \d+/i);
  });
});

describe('markdown coverage section', () => {
  it('labels the section as informational and not a task list', () => {
    const md = renderMarkdown(build(true));
    expect(md).toContain('## SDK surface (informational — not a task list)');
    expect(md).toContain('Do NOT treat unused SDK surface as an issue to fix');
    expect(md).toContain('`batch.send`, `emails.send`');
  });

  it('renders no coverage section when the report has none', () => {
    expect(renderMarkdown(build(false))).not.toContain('SDK surface');
  });
});

describe('cli coverage output', () => {
  function run(args: string[]) {
    // --no-skill: these fixtures are committed to this repo, and a scan now
    // writes the agent skill into whatever directory it is pointed at.
    return spawnSync('node', [cli, ...args, '--no-skill'], { encoding: 'utf8' });
  }

  it('emits coverage in --format json with used methods only', () => {
    const res = run([
      join(repoRoot, 'tests/fixtures/resend/coverage-basic'),
      '--format',
      'json',
      '--no-report',
    ]);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.schemaVersion).toBe('1.1.0');
    expect(parsed.coverage).toHaveLength(1);
    expect(parsed.coverage[0]).toEqual({
      provider: 'resend',
      used: ['emails.get', 'emails.send'],
    });
  });

  it('renders the surface section in default terminal output', () => {
    const res = run([join(repoRoot, 'tests/fixtures/resend/coverage-basic'), '--no-report']);
    expect(res.stdout).toContain('Resend surface');
    expect(res.stdout).toContain('Using: emails.get, emails.send');
  });

  it('omits the coverage key for url-pattern-only detection', () => {
    const res = run([
      join(repoRoot, 'tests/fixtures/resend/coverage-url-only'),
      '--format',
      'json',
      '--no-report',
    ]);
    const parsed = JSON.parse(res.stdout);
    expect('coverage' in parsed).toBe(false);
    expect(res.stdout).not.toContain('surface');
  });
});
