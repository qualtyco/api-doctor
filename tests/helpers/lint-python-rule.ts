/**
 * Runs the Python rule runtime against a fixture directory and returns diagnostics.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeParent = join(repoRoot, 'src/engines/python');
const providersRoot = join(repoRoot, 'src/providers');

export interface PyDiagnostic {
  file: string;
  line: number;
  column: number;
  ruleKey: string;
}

function listPyFiles(dir: string, root = dir, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listPyFiles(full, root, acc);
    else if (entry.name.endsWith('.py')) {
      acc.push(full.slice(root.length + 1).replace(/\\/g, '/'));
    }
  }
  return acc;
}

export function lintPythonFixture(fixtureDir: string, ruleKeys: string[]): PyDiagnostic[] {
  const files = listPyFiles(fixtureDir);
  const tmp = mkdtempSync(join(os.tmpdir(), 'api-doctor-py-test-'));
  const filesJson = join(tmp, 'files.json');
  writeFileSync(filesJson, JSON.stringify({ root: fixtureDir, files }), 'utf-8');

  try {
    const res = spawnSync(
      process.platform === 'win32' ? 'python' : 'python3',
      [
        '-m',
        'runtime',
        '--files-json',
        filesJson,
        '--rules',
        ruleKeys.join(','),
        '--providers-root',
        providersRoot,
      ],
      {
        env: { ...process.env, PYTHONPATH: runtimeParent },
        encoding: 'utf-8',
      },
    );
    if (res.error) throw res.error;
    if (res.status !== 0) {
      throw new Error(`Python runtime failed: ${res.stderr || res.stdout}`);
    }
    return JSON.parse(res.stdout) as PyDiagnostic[];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
