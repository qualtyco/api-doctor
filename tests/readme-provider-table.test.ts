/**
 * The root README's provider table, checked against the manifests.
 *
 * Every column here is hand-maintained, and hand-maintained numbers in a README
 * drift — the repo already knows this about the rule counts. Two of the columns
 * are worse than cosmetic when wrong:
 *
 *   - "SDK verified" is presented as a copy-pasteable npm spec. A wrong version
 *     there installs the wrong package.
 *   - "Upgrade plan" is a command a reader will paste verbatim. A target that
 *     does not reach any removal prints "No call sites change" at a project
 *     with work ahead of it — the worst failure this feature has, because it is
 *     silent and confident.
 *
 * So the table is asserted rather than reviewed by eye.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { everyRemovalOf, parseMigrationTarget, suggestTarget } from '../src/migration.js';
import { compareSemver } from '../src/plugin/installed-version.js';
import { providers } from '../src/providers/index.js';

interface Row {
  name: string;
  slug: string;
  rules: number;
  verified?: string;
  migrate?: string;
}

/** Parses the `| Provider | Rules | SDK verified | Upgrade plan |` table. */
function readTable(): Row[] {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf-8');
  const rows: Row[] = [];
  for (const line of readme.split('\n')) {
    // A data row links the rule count at src/providers/<slug>/README.md.
    const m = line.match(
      /^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*\[(\d+) rules?\]\([^)]*\/src\/providers\/([a-z0-9-]+)\/README\.md\)\s*\|([^|]*)\|([^|]*)\|/,
    );
    if (!m) continue;
    const cell = (raw: string): string | undefined => {
      const t = raw.trim().replace(/^`|`$/g, '').trim();
      return t === '—' || t === '' ? undefined : t;
    };
    rows.push({
      name: m[1],
      rules: Number(m[2]),
      slug: m[3],
      verified: cell(m[4]),
      migrate: cell(m[5]),
    });
  }
  return rows;
}

const rows = readTable();

describe('README provider table', () => {
  it('lists every registered provider, once', () => {
    expect(rows.length).toBe(providers.length);
    expect(rows.map((r) => r.slug).sort()).toEqual(providers.map((p) => p.name).sort());
  });

  it('states each provider\'s real rule count', () => {
    for (const row of rows) {
      const manifest = providers.find((p) => p.name === row.slug)!;
      const actual = new Set(manifest.rules.map((r) => r.key)).size;
      expect(row.rules, `${row.slug} rule count`).toBe(actual);
    }
  });

  it('states the verified SDK as an installable `pkg@version` spec', () => {
    for (const row of rows) {
      const manifest = providers.find((p) => p.name === row.slug)!;
      const verified = manifest.surface?.verified;
      if (!verified) {
        // Tiptap is the documented exception: no HTTP surface, so no surface
        // manifest, and its baseline is tracked in compatibility.ts plus the
        // sdk-watch WATCHED entry. Only the package name is checkable here.
        if (row.verified) {
          expect(manifest.compatibility, `${row.slug} claims a verified SDK`).toBeDefined();
          expect(row.verified.startsWith(`${manifest.compatibility!.package}@`)).toBe(true);
        }
        continue;
      }
      expect(row.verified, `${row.slug} verified cell`).toBe(
        `${manifest.surface!.packages[0]}@${verified.version}`,
      );
    }
  });

  it('offers an upgrade plan exactly where one exists', () => {
    for (const row of rows) {
      const manifest = providers.find((p) => p.name === row.slug)!;
      if (!manifest.compatibility) {
        expect(row.migrate, `${row.slug} has no compatibility data`).toBeUndefined();
        continue;
      }
      expect(row.migrate, `${row.slug} should offer a plan`).toBe(
        `--migrate ${row.slug}@${suggestTarget(manifest)}`,
      );
    }
  });

  it('publishes only targets that actually reach a removal', () => {
    // The silent-failure guard: a printed command that finds nothing is worse
    // than no command at all.
    for (const row of rows.filter((r) => r.migrate)) {
      const manifest = providers.find((p) => p.name === row.slug)!;
      const spec = row.migrate!.replace(/^--migrate\s+/, '');
      const parsed = parseMigrationTarget(spec);
      expect(parsed, `${row.migrate} must parse`).not.toHaveProperty('error');
      const { target, provider } = parsed as { target: string; provider: string };
      expect(provider).toBe(row.slug);
      for (const removal of everyRemovalOf(manifest)) {
        expect(
          compareSemver(target, removal.removedIn)! >= 0,
          `${row.migrate} must reach ${removal.removedIn}`,
        ).toBe(true);
      }
    }
  });
});
