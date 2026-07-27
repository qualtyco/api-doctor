/**
 * Python scan engine: spawns the stdlib-ast runtime and maps JSON diagnostics
 * onto ScanResult using manifest metadata.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { providers } from '../../providers/index.js';
import { ScanError } from '../../scan-error.js';
import { ruleLanguages, type RuleMeta, type ScanResult } from '../../types.js';
import type { EngineInput } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Builds rule metadata for python-capable rules on detected providers. */
export function buildPythonRuleConfig(detectedNames: Set<string>): Map<string, RuleMeta> {
  const ruleMetaByKey = new Map<string, RuleMeta>();
  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule of provider.rules) {
      if (!ruleLanguages(rule).includes('python')) continue;
      ruleMetaByKey.set(rule.key, rule);
    }
  }
  return ruleMetaByKey;
}

export function resolvePythonRuntimeDir(): string {
  const candidates: string[] = [
    join(__dirname, '../src/engines/python/runtime'),
    join(__dirname, 'runtime'),
    join(__dirname, '../engines/python/runtime'),
  ];

  try {
    const require = createRequire(import.meta.url);
    const pluginEntry = require.resolve('@api-doctor/cli/plugin');
    const distDir = dirname(pluginEntry);
    candidates.unshift(join(distDir, '../src/engines/python/runtime'));
  } catch {
    // ignore
  }

  for (const c of candidates) {
    if (existsSync(join(c, '__main__.py'))) return c;
  }

  throw new ScanError(
    'Could not locate the Python rule runtime (src/engines/python/runtime). Reinstall @api-doctor/cli.',
  );
}

export function resolveProvidersRoot(): string {
  const candidates: string[] = [
    join(__dirname, '../src/providers'),
    join(__dirname, '../../providers'),
    join(__dirname, '../providers'),
  ];

  try {
    const require = createRequire(import.meta.url);
    const pluginEntry = require.resolve('@api-doctor/cli/plugin');
    candidates.unshift(join(dirname(pluginEntry), '../src/providers'));
  } catch {
    // ignore
  }

  for (const c of candidates) {
    if (existsSync(join(c, 'resend'))) return c;
  }

  throw new ScanError('Could not locate src/providers for Python rule discovery.');
}

function findPythonBinary(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function runPython(
  pythonBin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null; error?: Error }> {
  return new Promise((resolveRun) => {
    const child = spawn(pythonBin, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolveRun({ stdout, stderr, code: null, error }));
    child.on('close', (code) => resolveRun({ stdout, stderr, code }));
  });
}

interface PyDiagnostic {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  ruleKey: string;
}

/** Runs the Python AST engine for enabled rules. */
export async function runPythonEngine(input: EngineInput): Promise<ScanResult[]> {
  if (input.ruleMetaByKey.size === 0 || input.files.length === 0) return [];

  const runtimeDir = resolvePythonRuntimeDir();
  const providersRoot = resolveProvidersRoot();
  const pythonBin = findPythonBinary();
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'api-doctor-py-'));
  const filesJsonPath = join(tmpDir, 'files.json');
  writeFileSync(
    filesJsonPath,
    JSON.stringify({ root: input.absRoot, files: input.files }),
    'utf-8',
  );

  try {
    const res = await runPython(
      pythonBin,
      [
        '-m',
        'runtime',
        '--files-json',
        filesJsonPath,
        '--rules',
        [...input.ruleMetaByKey.keys()].join(','),
        '--providers-root',
        providersRoot,
      ],
      {
        ...process.env,
        PYTHONPATH: [dirname(runtimeDir), process.env.PYTHONPATH].filter(Boolean).join(delimiter),
      },
    );

    if (res.error) {
      const err = res.error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new ScanError(
          'Python 3.10+ is required to scan .py files, but no python3 binary was found on PATH.',
          res.error,
        );
      }
      throw new ScanError('Failed to run the Python rule engine', res.error);
    }

    if (res.code !== 0) {
      const stderr = (res.stderr ?? '').trim();
      throw new ScanError(
        `Python rule engine failed${stderr ? `: ${stderr}` : ` (exit ${res.code})`}`,
      );
    }

    let diagnostics: PyDiagnostic[];
    try {
      diagnostics = JSON.parse(res.stdout) as PyDiagnostic[];
    } catch (err) {
      const stderr = (res.stderr ?? '').trim();
      throw new ScanError(
        `Python rule engine produced no parseable output${stderr ? `: ${stderr}` : ''}`,
        err,
      );
    }

    if (!Array.isArray(diagnostics)) {
      throw new ScanError('Python rule engine returned a non-array diagnostic payload');
    }

    const results: ScanResult[] = [];
    for (const d of diagnostics) {
      const meta = input.ruleMetaByKey.get(d.ruleKey);
      if (!meta) continue;
      const content = input.filesContent.get(d.file) ?? '';
      const line = d.line || 1;
      results.push({
        file: d.file,
        line,
        column: d.column || 1,
        endLine: d.endLine,
        endColumn: d.endColumn,
        snippet: content.split(/\r?\n/)[line - 1]?.trim() ?? '',
        ruleKey: d.ruleKey,
        rule: meta.resultRule,
        severity: meta.severity ?? 'error',
        message: meta.message,
        fix: meta.fix,
        docsUrl: meta.docsUrl,
      });
    }
    return results;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
