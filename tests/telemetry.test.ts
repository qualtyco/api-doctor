import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashProjectDir } from '../src/telemetry.js';

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
