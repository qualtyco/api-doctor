import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderTerminalReport } from '../../src/reporter/terminal.js';
import type { DetectedProvider, ScanResult } from '../../src/types.js';

const detected: DetectedProvider[] = [{ name: 'resend', source: 'imports', checked: true }];

function makeResults(count: number): ScanResult[] {
  return Array.from({ length: count }, (_, i) => ({
    file: `src/file-${i}.ts`,
    line: i + 1,
    column: 1,
    snippet: `const x${i} = 1;`,
    ruleKey: 'resend-api-key-hardcoded',
    rule: 'resend/security/api-key-hardcoded',
    severity: 'error' as const,
    message: 'Hardcoded Resend API key found in source code.',
    fix: 'Move the key to an environment variable.',
  }));
}

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '');
}

async function captureOutput(results: ScanResult[], verbose = false): Promise<string> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  try {
    await renderTerminalReport(results, detected, {
      verbose,
      reportDisplayPath: '.api-doctor/report.json',
    });
  } finally {
    spy.mockRestore();
  }
  return stripAnsi(lines.join('\n'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('terminal report truncation', () => {
  it('truncates past 20 findings and points at the JSON report', async () => {
    const output = await captureOutput(makeResults(25));
    expect(output).toContain('src/file-19.ts:20');
    expect(output).not.toContain('src/file-20.ts:21');
    expect(output).toContain('… and 5 more');
    expect(output).toContain('Showing 20 of 25 findings');
    expect(output).toContain('.api-doctor/report.json');
  });

  it('prints all findings when at or under the limit', async () => {
    const output = await captureOutput(makeResults(20));
    expect(output).toContain('src/file-19.ts:20');
    expect(output).not.toContain('Showing');
  });

  it('never truncates in verbose mode', async () => {
    const output = await captureOutput(makeResults(25), true);
    expect(output).toContain('src/file-24.ts:25');
    expect(output).not.toContain('Showing');
  });

  it('falls back to a --verbose hint when no report file is written', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    try {
      await renderTerminalReport(makeResults(25), detected, {});
    } finally {
      spy.mockRestore();
    }
    const output = stripAnsi(lines.join('\n'));
    expect(output).toContain('Showing 20 of 25 findings');
    expect(output).toContain('--verbose');
  });
});
