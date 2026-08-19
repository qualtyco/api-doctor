/**
 * `verifyHint` — the compatibility finding's "what to check before you trust
 * this rewrite" line.
 *
 * Three things are under test: the hand-written hints obey the discipline the
 * manifest documents, the hint reaches every output as its OWN field (never
 * folded into `message` or `fix`), and adding it made nothing new fire.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allRemovals } from '../../src/providers/index.js';
import { renderMarkdown } from '../../src/reporter/markdown.js';
import { buildReport } from '../../src/reporter/report-builder.js';
import type { DetectedProvider, ScanResult } from '../../src/types.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(repoRoot, 'dist/cli.mjs');
const BROKEN = join(repoRoot, 'tests/fixtures/s2/s2-removed-symbol-broken');
const FIXED = join(repoRoot, 'tests/fixtures/s2/s2-removed-symbol-fixed');

function run(args: string[]) {
  // --no-skill: these fixtures are committed to this repo, and a scan now
  // writes the agent skill into whatever directory it is pointed at.
  return spawnSync('node', [cli, ...args, '--no-skill'], { encoding: 'utf8' });
}

function build(results: ScanResult[]) {
  const detected: DetectedProvider[] = [{ name: 's2', source: 'package.json', checked: true }];
  return buildReport({
    results,
    detected,
    directory: '/tmp/project',
    filesScanned: 1,
    filesContent: new Map(),
    durationMs: 1,
    version: '9.9.9',
  });
}

function compatResult(partial: Partial<ScanResult> = {}): ScanResult {
  return {
    file: 'provision.ts',
    line: 1,
    column: 1,
    snippet: '',
    ruleKey: 's2-removed-symbol',
    rule: 's2/removed-symbol',
    severity: 'error',
    message: 'createOrReconfigureBasin was removed in 0.24.0 — you have 0.25.0 installed.',
    fix: 'Rename the call to ensureBasin.',
    verifyHint: 'Same PUT /basins/{basin}, same auth, same request shape.',
    ...partial,
  };
}

describe('verifyHint manifest discipline', () => {
  it('every removal carries a concrete, hand-written hint', () => {
    expect(allRemovals.length).toBeGreaterThan(0);
    for (const removal of allRemovals) {
      expect(typeof removal.verifyHint, removal.symbol).toBe('string');
      expect(removal.verifyHint.trim().length, removal.symbol).toBeGreaterThan(30);
    }
  });

  it('never ships a hint that only says "verify carefully"', () => {
    // A hint has to name the thing that could differ. An instruction to be
    // careful is not information, and would train readers to skip the line.
    for (const removal of allRemovals) {
      expect(
        /^\s*(please\s+)?(verify|check|review)\s+(this|it|that|carefully|thoroughly)\b/i.test(
          removal.verifyHint,
        ),
        `${removal.symbol}: hint must name what could differ`,
      ).toBe(false);
    }
  });

  it('a wire-identical rename says so, and names what is identical', () => {
    for (const removal of allRemovals.filter((r) => r.wireIdentical)) {
      expect(
        /no behavior change|identical|same request|same wire/i.test(removal.verifyHint),
        `${removal.symbol}: wireIdentical hint must state that nothing changes`,
      ).toBe(true);
      // "same auth", "same PUT /basins/{basin}" — something concrete, not just
      // the claim that it is safe.
      expect(/same\s+\S/i.test(removal.verifyHint), removal.symbol).toBe(true);
    }
  });
});

describe('verifyHint in the structured report', () => {
  it('is its own field on the finding, not folded into message or fix', () => {
    const finding = build([compatResult()]).findings[0];
    expect(finding.verifyHint).toBe('Same PUT /basins/{basin}, same auth, same request shape.');
    expect(finding.message).not.toContain('Same PUT');
    expect(finding.fix).not.toContain('Same PUT');
  });

  it('is absent entirely on findings that have no verified hint', () => {
    const finding = build([compatResult({ verifyHint: undefined })]).findings[0];
    expect('verifyHint' in finding).toBe(false);
  });
});

describe('verifyHint in markdown', () => {
  it('renders under its own Verify label', () => {
    const md = renderMarkdown(build([compatResult()]));
    expect(md).toContain('**Verify:** Same PUT /basins/{basin}, same auth, same request shape.');
  });

  it('emits no Verify line when the finding has no hint', () => {
    const md = renderMarkdown(build([compatResult({ verifyHint: undefined })]));
    expect(md).not.toContain('**Verify:**');
  });
});

describe('verifyHint end-to-end on the S2 fixtures', () => {
  it('renders the hint in the terminal report for the must-fire fixture', () => {
    const res = run([BROKEN, '--no-report']);
    expect(res.stdout).toContain('was removed in 0.24.0');
    expect(res.stdout).toMatch(/\n\s+Verify: Same PUT \/(basins|streams)\//);
    // The Verify line is guidance, never an upgrade nudge.
    expect(res.stdout).not.toMatch(/upgrad/i);
  });

  it('pairs the Verify line with the headline it sits under', () => {
    // The terminal groups by rule and shows one headline, so the hint must come
    // from the same finding as that message — a Verify line describing the
    // other symbol's endpoint would be worse than none.
    const res = run([BROKEN, '--no-report']);
    const headline = /× (createOrReconfigure(Basin|Stream)) was removed/.exec(res.stdout);
    expect(headline, 'expected a compatibility headline').not.toBeNull();
    const expectedPath = headline![2] === 'Basin' ? '/basins/{basin}' : '/streams/{stream}';
    expect(res.stdout).toContain(`Verify: Same PUT ${expectedPath}`);
  });

  it('carries the hint per finding in report.json, keyed separately', () => {
    const res = run([BROKEN, '--format', 'json', '--no-report']);
    const parsed = JSON.parse(res.stdout);
    const compat = parsed.findings.filter((f: any) => f.rule === 's2/removed-symbol');
    expect(compat.length).toBeGreaterThan(0);
    for (const finding of compat) {
      expect(finding.verifyHint, finding.message).toMatch(/No behavior change/);
      expect(finding.verifyHint).not.toBe(finding.fix);
    }
    // Both symbols are in this fixture; each gets its own path, not a shared one.
    const hints = new Set(compat.map((f: any) => f.verifyHint));
    expect(hints.size).toBe(2);
    expect([...hints].some((h: any) => h.includes('/basins/{basin}'))).toBe(true);
    expect([...hints].some((h: any) => h.includes('/streams/{stream}'))).toBe(true);
  });

  it('labels the hint for agents in the markdown export', () => {
    const res = run([BROKEN, '--format', 'markdown', '--no-report']);
    expect(res.stdout).toContain('**Verify:** Same PUT /basins/{basin}');
    expect(res.stdout).toContain('**Verify:** Same PUT /streams/{stream}');
  });

  it('still produces zero findings on the pinned-0.23.0 fixture', () => {
    // The must-not-fire case. Adding a field to the removal entries must not
    // give the rule anything new to fire on.
    const res = run([FIXED, '--format', 'json', '--no-report']);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.findings.filter((f: any) => f.rule === 's2/removed-symbol')).toHaveLength(0);
    expect(res.stdout).not.toContain('verifyHint');
  });
});
