import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearInstalledVersionCache,
  compareSemver,
  parseSemver,
  rangeLowerBound,
  resolveInstalledVersion,
} from '../src/plugin/installed-version.js';

const PKG = '@s2-dev/streamstore';

describe('semver helpers', () => {
  it('parses core versions and rejects non-versions', () => {
    expect(parseSemver('0.24.0')).toEqual([0, 24, 0]);
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('1.2.3-beta.1')).toEqual([1, 2, 3]);
    expect(parseSemver('latest')).toBeNull();
    expect(parseSemver('1.2')).toBeNull();
  });

  it('compares versions numerically, not lexically', () => {
    expect(compareSemver('0.25.0', '0.24.0')).toBe(1);
    expect(compareSemver('0.24.0', '0.24.0')).toBe(0);
    expect(compareSemver('0.9.0', '0.24.0')).toBe(-1);
    expect(compareSemver('0.24.0', 'nope')).toBeNull();
  });

  it('extracts range lower bounds only for unambiguous shapes', () => {
    expect(rangeLowerBound('0.25.0')).toBe('0.25.0');
    expect(rangeLowerBound('^0.24.1')).toBe('0.24.1');
    expect(rangeLowerBound('~1.2.3')).toBe('1.2.3');
    expect(rangeLowerBound('>=2.0.0')).toBe('2.0.0');
    expect(rangeLowerBound('*')).toBeNull();
    expect(rangeLowerBound('workspace:^')).toBeNull();
    expect(rangeLowerBound('npm:other@1.0.0')).toBeNull();
  });
});

describe('resolveInstalledVersion', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(os.tmpdir(), 'api-doctor-iv-'));
    clearInstalledVersionCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    clearInstalledVersionCache();
  });

  function write(path: string, content: unknown): void {
    const abs = join(dir, path);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, JSON.stringify(content, null, 2), 'utf-8');
  }

  it('trusts an exact pin in the owning package.json outright', () => {
    write('package.json', { dependencies: { [PKG]: '0.23.0' } });
    // Even with a differing node_modules — the pin is unambiguous intent.
    write(`node_modules/${PKG}/package.json`, { name: PKG, version: '0.25.0' });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBe('0.23.0');
  });

  it('resolves a range through node_modules to the exact installed version', () => {
    write('package.json', { dependencies: { [PKG]: '^0.24.0' } });
    write(`node_modules/${PKG}/package.json`, { name: PKG, version: '0.24.3' });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBe('0.24.3');
  });

  it('falls back to package-lock.json when node_modules is absent', () => {
    write('package.json', { dependencies: { [PKG]: '^0.24.0' } });
    write('package-lock.json', {
      lockfileVersion: 3,
      packages: { [`node_modules/${PKG}`]: { version: '0.24.2' } },
    });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBe('0.24.2');
  });

  it('falls back to the declared range lower bound with no install state', () => {
    write('package.json', { dependencies: { [PKG]: '^0.25.0' } });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBe('0.25.0');
  });

  it('walks past a package.json that does not declare the package (monorepo member)', () => {
    write('package.json', { dependencies: { [PKG]: '0.24.1' } });
    write('packages/app/package.json', { name: 'app' });
    mkdirSync(join(dir, 'packages/app/src'), { recursive: true });
    writeFileSync(join(dir, 'packages/app/src/index.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'packages/app/src/index.ts'), PKG)).toBe('0.24.1');
  });

  it('returns null when nothing resolves — callers must stay silent', () => {
    write('package.json', { name: 'no-s2-here' });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBeNull();
  });

  it('returns null for an unresolvable range spec rather than guessing', () => {
    write('package.json', { dependencies: { [PKG]: 'latest' } });
    writeFileSync(join(dir, 'app.ts'), '', 'utf-8');
    expect(resolveInstalledVersion(join(dir, 'app.ts'), PKG)).toBeNull();
  });
});
