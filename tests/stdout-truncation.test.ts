/**
 * `--format json` and `--format markdown` must survive a pipe.
 *
 * Node buffers writes to a pipe and `process.exit()` throws away whatever has
 * not drained, so a report larger than the OS pipe buffer (64 KiB on macOS and
 * Linux) used to be cut off mid-token while the process still exited 0. A
 * machine-readable mode that succeeds and emits invalid JSON is worse than one
 * that fails: the consumer blames its own parser.
 *
 * The test therefore has to run the real binary with stdout as a real pipe.
 * Anything that captures output in-process — mocking `write`, importing the
 * reporter — cannot observe this bug at all, which is how it survived.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(process.cwd(), 'dist', 'cli.mjs');
/** The pipe buffer the old code truncated at. The report must clear it. */
const PIPE_BUFFER = 64 * 1024;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'api-doctor-stdout-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'big', dependencies: { resend: '6.20.0' } }),
    'utf-8',
  );
  const src = join(dir, 'src');
  mkdirSync(src, { recursive: true });
  // Enough findings, each carrying a code snippet, to push the report well past
  // the pipe buffer.
  for (let i = 0; i < 60; i++) {
    writeFileSync(
      join(src, `mailer${i}.ts`),
      [
        `import { Resend } from 'resend';`,
        ``,
        `// Sending routine number ${i} for the marketing pipeline.`,
        `const resend = new Resend('re_abcdefghijklmnop${i}');`,
        ``,
        `export async function send${i}(to: string) {`,
        `  return resend.emails.send({`,
        `    from: 'onboarding@resend.dev',`,
        `    to,`,
        `    subject: 'Message ${i}',`,
        `    html: '<p>Hello from mailer ${i}</p>',`,
        `  });`,
        `}`,
        ``,
      ].join('\n'),
      'utf-8',
    );
  }
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Runs the CLI with stdout as a pipe, as any real consumer would. */
function run(format: string): string {
  return execFileSync(
    process.execPath,
    [CLI, dir, '--format', format, '--no-report', '--no-skill', '--no-telemetry', '--no-fix'],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
}

describe('structured output through a pipe', () => {
  it('emits the whole JSON document, not the first 64 KiB of it', () => {
    const out = run('json');
    expect(out.length).toBeGreaterThan(PIPE_BUFFER);
    // The real assertion: it parses. A truncated document does not.
    const parsed = JSON.parse(out);
    expect(parsed.kind).toBe('scan');
    expect(parsed.findings.length).toBeGreaterThan(0);
    // And the tail is present — the part the old code dropped.
    expect(out.trimEnd().endsWith('}')).toBe(true);
  }, 120_000);

  it('emits the whole markdown document', () => {
    const out = run('markdown');
    expect(out.length).toBeGreaterThan(PIPE_BUFFER);
    // Every finding's file should appear; the last one proves nothing was cut.
    expect(out).toContain('mailer59.ts');
  }, 120_000);
});
