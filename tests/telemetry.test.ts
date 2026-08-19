import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compatTelemetry, hashProjectDir } from '../src/telemetry.js';
import type { DetectedProvider, ScanResult } from '../src/types.js';

describe('hashProjectDir', () => {
  it('returns the same hash for the same absolute path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-hash-'));
    try {
      const absolute = resolve(dir);
      expect(hashProjectDir(absolute)).toBe(hashProjectDir(absolute));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns different hashes for different paths', () => {
    const dirA = mkdtempSync(join(tmpdir(), 'api-doctor-hash-a-'));
    const dirB = mkdtempSync(join(tmpdir(), 'api-doctor-hash-b-'));
    try {
      expect(hashProjectDir(resolve(dirA))).not.toBe(hashProjectDir(resolve(dirB)));
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it('matches absolute path hash when given a relative path from cwd', () => {
    const dir = mkdtempSync(join(process.cwd(), 'api-doctor-hash-rel-'));
    try {
      const absolute = resolve(dir);
      const fromCwd = relative(process.cwd(), absolute);
      expect(hashProjectDir(fromCwd)).toBe(hashProjectDir(absolute));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function compatResult(message: string): ScanResult {
  return {
    file: 'src/provision.ts',
    line: 4,
    column: 9,
    snippet: '',
    ruleKey: 's2-removed-symbol',
    rule: 's2/removed-symbol',
    severity: 'error',
    message,
    fix: '',
  };
}

const s2Detected: DetectedProvider[] = [
  { name: 's2', source: 'package.json', checked: true },
];

describe('compatTelemetry', () => {
  it('reports counts, closed-vocabulary symbols, and the resolved installed version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-compat-'));
    try {
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ dependencies: { '@s2-dev/streamstore': '0.25.0' } }),
        'utf-8',
      );
      const results = [
        compatResult('createOrReconfigureBasin was removed in 0.24.0 — you have 0.25.0 installed.'),
        compatResult('createOrReconfigureBasin was removed in 0.24.0 — you have 0.25.0 installed.'),
        compatResult('createOrReconfigureStream was removed in 0.24.0 — you have 0.25.0 installed.'),
      ];
      const { props, symbols } = compatTelemetry(results, s2Detected, dir, undefined);
      expect(props.compat_findings).toBe(3);
      expect(symbols).toEqual(['createOrReconfigureBasin', 'createOrReconfigureStream']);
      expect(props.compat_symbols).toEqual(symbols);
      expect(props.compat_installed_version).toBe('0.25.0');
      expect(props.compat_fixed_since_last_run).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('counts symbols resolved since the previous run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-compat-'));
    try {
      const results = [
        compatResult('createOrReconfigureStream was removed in 0.24.0 — you have 0.25.0 installed.'),
      ];
      const prev = ['createOrReconfigureBasin', 'createOrReconfigureStream'];
      const { props } = compatTelemetry(results, s2Detected, dir, prev);
      expect(props.compat_fixed_since_last_run).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never leaks message text outside the manifest vocabulary and omits an unresolvable version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'api-doctor-compat-'));
    try {
      // A fallback static message does not start with a known symbol name.
      const results = [
        compatResult('Code references an @s2-dev/streamstore symbol that does not exist.'),
      ];
      const { props, symbols } = compatTelemetry(results, s2Detected, dir, undefined);
      expect(props.compat_findings).toBe(1);
      expect(symbols).toEqual([]);
      expect(props).not.toHaveProperty('compat_installed_version');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
