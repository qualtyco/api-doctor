import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { batchFileArgs } from '../src/engines/js/runner.js';
import { scan } from '../src/scanner.js';

/**
 * Findings may only name files the scan actually walked.
 *
 * The engine used to hand oxlint the directory (`.`) and rely on its
 * `ignorePatterns` to skip node_modules. That does not hold when a JS plugin is
 * registered — oxlint 1.68 linted every dependency's shipped .js — so a scan
 * reported findings in files it never opened, in a report whose own
 * filesScanned count said 2. It also tanked the score with issues in code the
 * developer does not own.
 *
 * The tree is built at runtime rather than committed: a fixture containing a
 * real `node_modules/` directory would be swallowed by .gitignore and the
 * regression would silently stop being covered.
 */
let projectDir: string;

const OFFENDING_TS = `import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function send(to: string) {
  return resend.emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject: 'Hi',
    html: '<p>Hi</p>',
  });
}
`;

// The dependency copies must be plain JavaScript. A type annotation in a .js
// file does not parse, and an unparseable file yields no diagnostics — which
// would make this suite pass for the wrong reason, whatever the engine does.
const OFFENDING_JS = OFFENDING_TS.replace('to: string', 'to');

beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'api-doctor-depdirs-'));
  writeFileSync(
    join(projectDir, 'package.json'),
    JSON.stringify({ name: 'p', dependencies: { resend: '6.20.0' } }),
    'utf-8',
  );

  mkdirSync(join(projectDir, 'src'), { recursive: true });
  writeFileSync(join(projectDir, 'src', 'app.ts'), OFFENDING_TS, 'utf-8');

  // The identical offending code in places a scan must never report on: an
  // installed dependency (including a scoped one, the shape that first
  // surfaced this) and a build directory.
  for (const dir of [
    join(projectDir, 'node_modules', 'some-dep'),
    join(projectDir, 'node_modules', '@scope', 'pkg', 'dist'),
    join(projectDir, 'dist'),
  ]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.js'), OFFENDING_JS, 'utf-8');
  }
});

afterAll(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

describe('scan ignores dependency and build directories', () => {
  it('walks only the project source file', async () => {
    const { filesScanned } = await scan(projectDir);
    expect(filesScanned).toBe(1);
  });

  it('reports findings only in files it walked', async () => {
    const { results } = await scan(projectDir);

    // The fixture is deliberately one that fires, so "no node_modules
    // findings" cannot pass by the rules simply never matching.
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.file).toBe('src/app.ts');
    }
  });

  it('reports nothing from node_modules or dist', async () => {
    const { results } = await scan(projectDir);
    const leaked = results.filter((r) => /(^|\/)(node_modules|dist)\//.test(r.file));
    expect(leaked).toEqual([]);
  });
});

describe('batchFileArgs', () => {
  it('keeps every file when the list fits in one batch', () => {
    const files = ['a.ts', 'b.ts', 'c.ts'];
    expect(batchFileArgs(files)).toEqual([files]);
  });

  it('splits past the byte budget without dropping or duplicating a file', () => {
    const files = Array.from({ length: 500 }, (_, i) => `src/very/deep/path/file-${i}.ts`);
    const batches = batchFileArgs(files, 1024);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(files);
    for (const batch of batches) {
      const bytes = batch.reduce((n, f) => n + Buffer.byteLength(f) + 1, 0);
      // Only a single over-budget path may exceed the budget on its own.
      if (batch.length > 1) expect(bytes).toBeLessThanOrEqual(1024);
    }
  });

  it('still emits a path that exceeds the budget on its own', () => {
    const huge = `src/${'x'.repeat(400)}.ts`;
    expect(batchFileArgs([huge, 'a.ts'], 64).flat()).toEqual([huge, 'a.ts']);
  });

  it('returns no batches for an empty list', () => {
    expect(batchFileArgs([])).toEqual([]);
  });
});
