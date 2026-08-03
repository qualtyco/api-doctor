/**
 * JS/TS scan engine: shells out to oxlint with the bundled api-doctor plugin.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, relative } from 'node:path';
import { PLUGIN_NAME, SKIP_DIR_NAMES } from '../../constants.js';
import { providers } from '../../providers/index.js';
import { ScanError } from '../../scan-error.js';
import { ruleLanguages, type RuleMeta, type ScanResult } from '../../types.js';
import type { EngineInput } from '../types.js';

export const ENGINE_SKIP_DIRS = SKIP_DIR_NAMES;

/** Builds oxlint rule config for javascript-capable rules on detected providers. */
export function buildJsRuleConfig(detectedNames: Set<string>): {
  oxlintRules: Record<string, 'error' | 'warn' | 'off'>;
  ruleMetaByKey: Map<string, RuleMeta>;
} {
  const oxlintRules: Record<string, 'error' | 'warn' | 'off'> = {};
  const ruleMetaByKey = new Map<string, RuleMeta>();

  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule of provider.rules) {
      if (!ruleLanguages(rule).includes('javascript')) continue;
      oxlintRules[`${PLUGIN_NAME}/${rule.key}`] =
        rule.severity === 'error' || rule.severity === undefined ? 'error' : 'warn';
      ruleMetaByKey.set(rule.key, rule);
    }
  }

  return { oxlintRules, ruleMetaByKey };
}

function runOxlint(
  oxlintBin: string,
  args: string[],
  cwd: string,
  clientMapPath?: string,
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [oxlintBin, ...args], {
      cwd,
      env: clientMapPath
        ? { ...process.env, API_DOCTOR_CLIENT_MODULES: clientMapPath }
        : process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolveRun({ stdout, stderr, error }));
    child.on('close', () => resolveRun({ stdout, stderr }));
  });
}

function mapDiagnosticToResult(
  d: any,
  absRoot: string,
  ruleMetaByKey: Map<string, RuleMeta>,
  filesContent: Map<string, string>,
): ScanResult | null {
  const code = String(d.code ?? '');
  const matched = [...ruleMetaByKey.entries()].find(([key]) => code.includes(key));
  if (!matched) return null;
  const [ruleKey, meta] = matched;

  const relFile = (() => {
    const filename = String(d.filename ?? '');
    if (!filename) return '';
    if (filename.startsWith(absRoot)) return relative(absRoot, filename);
    return filename.replace(/^[.\\/]+/, '');
  })();

  const span = d.labels?.[0]?.span;
  const line = typeof span?.line === 'number' ? span.line : 1;
  const column = typeof span?.column === 'number' ? span.column : 1;
  const endLine = typeof span?.endLine === 'number' ? span.endLine : undefined;
  const endColumn = typeof span?.endColumn === 'number' ? span.endColumn : undefined;

  const content = filesContent.get(relFile) ?? '';
  const snippet = content.split(/\r?\n/)[line - 1]?.trim() ?? '';

  return {
    file: relFile,
    line,
    column,
    endLine,
    endColumn,
    snippet,
    ruleKey,
    rule: meta.resultRule,
    severity: meta.severity ?? (d.severity === 'warning' ? 'warning' : 'error'),
    message: meta.message,
    fix: meta.fix,
    docsUrl: meta.docsUrl,
  };
}

/** Runs oxlint against the project for enabled JS/TS rules. */
export async function runJsEngine(input: EngineInput): Promise<ScanResult[]> {
  if (input.ruleMetaByKey.size === 0 || input.files.length === 0) return [];

  const oxlintRules: Record<string, 'error' | 'warn' | 'off'> = {};
  for (const [key, meta] of input.ruleMetaByKey) {
    oxlintRules[`${PLUGIN_NAME}/${key}`] =
      meta.severity === 'error' || meta.severity === undefined ? 'error' : 'warn';
  }

  const require = createRequire(import.meta.url);
  const pluginEntry = require.resolve('@api-doctor/cli/plugin');

  let oxlintBin: string;
  try {
    const oxlintPkgPath = require.resolve('oxlint/package.json');
    const oxlintPkg = require(oxlintPkgPath);
    const binRel =
      typeof oxlintPkg.bin === 'string' ? oxlintPkg.bin : oxlintPkg.bin?.oxlint;
    if (!binRel) throw new Error('oxlint package.json declares no "oxlint" bin');
    oxlintBin = join(dirname(oxlintPkgPath), binRel);
  } catch (err) {
    throw new ScanError(
      'Could not locate the bundled oxlint package — try reinstalling @api-doctor/cli',
      err,
    );
  }

  const tmpDir = mkdtempSync(join(os.tmpdir(), 'api-doctor-oxlint-'));
  const configPath = join(tmpDir, 'oxlintrc.json');
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        // Alias form pins the plugin name: without it oxlint derives the name
        // from the surrounding package (`@api-doctor/cli`), and every
        // `api-doctor/<rule>` entry fails with "Plugin 'api-doctor' not found".
        jsPlugins: [{ name: PLUGIN_NAME, specifier: pluginEntry }],
        rules: oxlintRules,
        ignorePatterns: ENGINE_SKIP_DIRS,
      },
      null,
      2,
    ),
    'utf-8',
  );

  // Cross-file client identities, resolved in the CLI process where module
  // resolution is available. The plugin-side tracker cannot compute these —
  // it never leaves the file it is linting — so they are handed over as an
  // extra, purely additive evidence source.
  let clientMapPath: string | undefined;
  if (process.env.API_DOCTOR_DUMP_CLIENT_MODULES && !Object.keys(input.clientBindings ?? {}).length) {
    writeFileSync(process.env.API_DOCTOR_DUMP_CLIENT_MODULES, '{"__EMPTY__":true}', 'utf-8');
  }
  if (input.clientBindings && Object.keys(input.clientBindings).length > 0) {
    try {
      clientMapPath = join(tmpDir, 'client-modules.json');
      writeFileSync(clientMapPath, JSON.stringify(input.clientBindings), 'utf-8');
      if (process.env.API_DOCTOR_DUMP_CLIENT_MODULES) {
        writeFileSync(
          process.env.API_DOCTOR_DUMP_CLIENT_MODULES,
          JSON.stringify(input.clientBindings, null, 2),
          'utf-8',
        );
      }
    } catch {
      clientMapPath = undefined; // never let this break a scan
    }
  }

  try {
    const res = await runOxlint(
      oxlintBin,
      ['--config', configPath, '--format', 'json', '.'],
      input.absRoot,
      clientMapPath,
    );

    if (res.error) throw new ScanError('Failed to run oxlint', res.error);

    let parsed: any;
    try {
      parsed = JSON.parse(res.stdout);
    } catch (err) {
      const stderr = (res.stderr ?? '').toString().trim();
      throw new ScanError(
        `oxlint produced no parseable output${stderr ? `: ${stderr}` : ''}`,
        err,
      );
    }

    const results: ScanResult[] = [];
    for (const d of parsed.diagnostics ?? []) {
      const mapped = mapDiagnosticToResult(
        d,
        input.absRoot,
        input.ruleMetaByKey,
        input.filesContent,
      );
      if (mapped) results.push(mapped);
    }
    return results;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
