/**
 * The two directions of the compatibility gate must agree.
 *
 * A migration plan and a compatibility scan are the same rule asking the same
 * question from opposite sides of one version. So for a fixed body of code:
 *
 *   sites the plan lists at version V   ===   errors the scan reports at V
 *
 * If those ever diverge, one of the two is lying — either the plan sends an
 * agent to change code that would have kept working, or the scan reports a
 * break the plan never warned about. Both are worse than a missing feature,
 * because both look authoritative.
 *
 * This is an end-to-end test through the real engine: same files, two
 * package.json versions, real oxlint, real version resolution.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearInstalledVersionCache } from '../src/plugin/installed-version.js';
import { scan } from '../src/scanner.js';

const FIXTURES = join(process.cwd(), 'tests', 'fixtures');

/** Copies a fixture into a temp dir and pins the SDK to `version`. */
function project(fixture: string, pkg: string, version: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'api-doctor-symmetry-'));
  cpSync(fixture, dir, { recursive: true });
  const manifestPath = join(dir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.dependencies = { ...manifest.dependencies, [pkg]: version };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return dir;
}

/** `file:line` for every compatibility finding, sorted. */
function sites(results: { file: string; line: number; ruleKey: string }[]): string[] {
  return results
    .filter((r) => /-removed-(method|symbol)$/.test(r.ruleKey))
    .map((r) => `${r.file}:${r.line}`)
    .sort();
}

const dirs: string[] = [];
beforeEach(() => clearInstalledVersionCache());
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  clearInstalledVersionCache();
});

describe.each([
  {
    name: 'supabase v1 → v2',
    fixture: join(FIXTURES, 'supabase', 'supabase-removed-method-pinned-v1'),
    pkg: '@supabase/supabase-js',
    before: '1.35.7',
    after: '2.112.3',
    provider: 'supabase',
    target: '2.999999.999999',
  },
  {
    name: 'tiptap v2 → v3',
    fixture: join(FIXTURES, 'tiptap', 'tiptap-removed-symbol-pinned-v2'),
    pkg: '@tiptap/react',
    before: '2.27.2',
    after: '3.30.2',
    provider: 'tiptap',
    target: '3.999999.999999',
  },
])('$name', ({ fixture, pkg, before, after, provider, target }) => {
  it('plans exactly the sites the post-upgrade scan reports', async () => {
    const oldDir = project(fixture, pkg, before);
    const newDir = project(fixture, pkg, after);
    dirs.push(oldDir, newDir);

    // Forward: what breaks if we move.
    clearInstalledVersionCache();
    const planned = await scan(oldDir, {
      migrate: { provider, target, label: 'x', raw: 'x' },
    });

    // Backward: what is broken once we have moved. Same files.
    clearInstalledVersionCache();
    const broken = await scan(newDir);

    const plannedSites = sites(planned.results);
    const brokenSites = sites(broken.results);

    expect(plannedSites.length).toBeGreaterThan(0);
    expect(plannedSites).toEqual(brokenSites);
  }, 120_000);

  it('says nothing in either direction once the project is already there', async () => {
    const dir = project(fixture, pkg, after);
    dirs.push(dir);

    clearInstalledVersionCache();
    const planned = await scan(dir, {
      migrate: { provider, target, label: 'x', raw: 'x' },
    });
    // Already past every removal: there is no move left to plan, even though
    // the very same calls are reported as broken by an ordinary scan.
    expect(sites(planned.results)).toEqual([]);
  }, 120_000);

  it('says nothing when the code is correct for the version it is pinned to', async () => {
    const dir = project(fixture, pkg, before);
    dirs.push(dir);

    clearInstalledVersionCache();
    const plain = await scan(dir);
    expect(sites(plain.results)).toEqual([]);
  }, 120_000);
});
