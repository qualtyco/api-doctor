/**
 * `catalog:` dereferencing in the installed-version resolver.
 *
 * This is the resolver every compatibility finding is gated on, so the tests
 * that matter most here are the negative ones. A wrong version makes a rule
 * claim a working call throws; an unresolvable one makes it stay silent. Silent
 * is the correct failure, and every path below that cannot produce a confident
 * answer must reach it.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearInstalledVersionCache,
  resolveInstalledVersion,
} from '../src/plugin/installed-version.js';

const PKG = '@supabase/supabase-js';
let root: string;

beforeEach(() => {
  clearInstalledVersionCache();
  root = mkdtempSync(join(tmpdir(), 'api-doctor-catalog-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  clearInstalledVersionCache();
});

/** Writes a workspace: root manifest + one member declaring `catalog:`. */
function workspace(rootManifest: unknown, memberSpec = 'catalog:'): string {
  writeFileSync(join(root, 'package.json'), JSON.stringify(rootManifest), 'utf-8');
  const member = join(root, 'apps', 'web');
  mkdirSync(join(member, 'src'), { recursive: true });
  writeFileSync(
    join(member, 'package.json'),
    JSON.stringify({ name: 'web', dependencies: { [PKG]: memberSpec } }),
    'utf-8',
  );
  return join(member, 'src', 'index.ts');
}

describe('catalog: in package.json', () => {
  it('resolves a top-level Bun catalog from the workspace root', () => {
    const file = workspace({
      name: 'r',
      workspaces: ['apps/*'],
      catalog: { [PKG]: '^2.112.0' },
    });
    expect(resolveInstalledVersion(file, PKG)).toBe('2.112.0');
  });

  it('resolves a catalog nested under `workspaces`', () => {
    const file = workspace({
      name: 'r',
      workspaces: { packages: ['apps/*'], catalog: { [PKG]: '2.98.0' } },
    });
    expect(resolveInstalledVersion(file, PKG)).toBe('2.98.0');
  });

  it('resolves a named catalog, and only the one named', () => {
    const file = workspace(
      {
        name: 'r',
        catalogs: { legacy: { [PKG]: '1.35.7' }, next: { [PKG]: '2.112.0' } },
      },
      'catalog:legacy',
    );
    expect(resolveInstalledVersion(file, PKG)).toBe('1.35.7');
  });

  it('stays silent when the catalog does not list the package', () => {
    const file = workspace({ name: 'r', catalog: { react: '^18.0.0' } });
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });

  it('stays silent on a named catalog that does not exist', () => {
    const file = workspace({ name: 'r', catalog: { [PKG]: '2.1.0' } }, 'catalog:nope');
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });

  it('never follows a catalog entry that points at another catalog', () => {
    // One dereference only — a self-referential catalog must terminate.
    const file = workspace({ name: 'r', catalog: { [PKG]: 'catalog:' } });
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });

  it('stays silent when the catalog spec is not a version', () => {
    const file = workspace({ name: 'r', catalog: { [PKG]: 'workspace:*' } });
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });
});

describe('catalog: in pnpm-workspace.yaml', () => {
  function pnpmWorkspace(yaml: string, memberSpec = 'catalog:'): string {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'r' }), 'utf-8');
    writeFileSync(join(root, 'pnpm-workspace.yaml'), yaml, 'utf-8');
    const member = join(root, 'apps', 'web');
    mkdirSync(join(member, 'src'), { recursive: true });
    writeFileSync(
      join(member, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { [PKG]: memberSpec } }),
      'utf-8',
    );
    return join(member, 'src', 'index.ts');
  }

  it('reads the default catalog block', () => {
    const file = pnpmWorkspace(
      ['packages:', "  - 'apps/*'", 'catalog:', `  '${PKG}': ^2.100.0`, '  react: ^18.2.0'].join('\n'),
    );
    expect(resolveInstalledVersion(file, PKG)).toBe('2.100.0');
  });

  it('reads a named catalog block', () => {
    const file = pnpmWorkspace(
      ['catalogs:', '  legacy:', `    ${PKG}: 1.35.7`, '  next:', `    ${PKG}: 2.112.0`].join('\n'),
      'catalog:legacy',
    );
    expect(resolveInstalledVersion(file, PKG)).toBe('1.35.7');
  });

  it('ignores comments and blank lines', () => {
    const file = pnpmWorkspace(
      ['# shared versions', '', 'catalog:', '  # the db client', `  ${PKG}: ~2.50.1`].join('\n'),
    );
    expect(resolveInstalledVersion(file, PKG)).toBe('2.50.1');
  });

  it('does not read a package out of the wrong block', () => {
    const file = pnpmWorkspace(
      ['packages:', `  - '${PKG}'`, 'onlyBuiltDependencies:', `  - ${PKG}`].join('\n'),
    );
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });

  it('gives up on a nested shape rather than guessing at it', () => {
    const file = pnpmWorkspace(
      ['catalog:', `  ${PKG}:`, '    version: 2.112.0'].join('\n'),
    );
    expect(resolveInstalledVersion(file, PKG)).toBeNull();
  });

  it('stays silent on a missing or unreadable workspace file', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'r' }), 'utf-8');
    const member = join(root, 'apps', 'web');
    mkdirSync(join(member, 'src'), { recursive: true });
    writeFileSync(
      join(member, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { [PKG]: 'catalog:' } }),
      'utf-8',
    );
    expect(resolveInstalledVersion(join(member, 'src', 'a.ts'), PKG)).toBeNull();
  });
});

describe('catalog: does not disturb the ordinary paths', () => {
  it('an inline exact pin still wins over any catalog', () => {
    const file = workspace({ name: 'r', catalog: { [PKG]: '2.112.0' } }, '1.35.7');
    expect(resolveInstalledVersion(file, PKG)).toBe('1.35.7');
  });

  it('node_modules still beats the catalog range', () => {
    const file = workspace({ name: 'r', catalog: { [PKG]: '^2.0.0' } });
    const nm = join(root, 'apps', 'web', 'node_modules', PKG);
    mkdirSync(nm, { recursive: true });
    writeFileSync(join(nm, 'package.json'), JSON.stringify({ version: '2.104.9' }), 'utf-8');
    expect(resolveInstalledVersion(file, PKG)).toBe('2.104.9');
  });
});
