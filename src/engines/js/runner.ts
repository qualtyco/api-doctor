/**
 * JS/TS scan engine: shells out to oxlint with the bundled api-doctor plugin.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join, relative } from 'node:path';
import { PLUGIN_NAME, SKIP_DIR_NAMES } from '../../constants.js';
import { getRuleDocsMeta } from '../../plugin/rule-registry.js';
import { providers, verifyHintFromMessage } from '../../providers/index.js';
import { ScanError } from '../../scan-error.js';
import { ruleLanguages, type RuleMeta, type ScanResult } from '../../types.js';
import type { EngineInput } from '../types.js';

export const ENGINE_SKIP_DIRS = SKIP_DIR_NAMES;

/**
 * Maps rule key → metadata for javascript-capable rules on detected providers.
 * The oxlint severity map is built where it is used (runJsEngine), not here.
 */
export function buildJsRuleConfig(detectedNames: Set<string>): {
  ruleMetaByKey: Map<string, RuleMeta>;
} {
  const ruleMetaByKey = new Map<string, RuleMeta>();

  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule of provider.rules) {
      if (!ruleLanguages(rule).includes('javascript')) continue;
      ruleMetaByKey.set(rule.key, rule);
    }
  }

  return { ruleMetaByKey };
}

function runOxlint(
  oxlintBin: string,
  args: string[],
  cwd: string,
  clientMapPath?: string,
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  return new Promise((resolveRun) => {
    // Always own this variable: a stale API_DOCTOR_CLIENT_MODULES inherited
    // from the parent environment must never leak into the subprocess.
    const env = { ...process.env };
    delete env.API_DOCTOR_CLIENT_MODULES;
    if (clientMapPath) env.API_DOCTOR_CLIENT_MODULES = clientMapPath;
    const child = spawn(process.execPath, [oxlintBin, ...args], { cwd, env });
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

/**
 * Splits the file list into argv-sized batches.
 *
 * The files are passed to oxlint explicitly rather than letting it walk the
 * directory (see runJsEngine), which means a large repo can push past the
 * platform's argv limit. ARG_MAX is 1 MiB on macOS and 2 MiB on common Linux;
 * the budget below is deliberately far under the smaller of those, because the
 * limit covers the environment block too and blowing it is an opaque E2BIG
 * rather than a useful error.
 */
export function batchFileArgs(files: string[], budgetBytes = 96 * 1024): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const file of files) {
    const cost = Buffer.byteLength(file, 'utf8') + 1; // + argv NUL
    // A single path over budget still gets its own batch: dropping a file
    // silently would be a scan that lies about its coverage.
    if (current.length > 0 && size + cost > budgetBytes) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(file);
    size += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function mapDiagnosticToResult(
  d: any,
  absRoot: string,
  ruleMetaByKey: Map<string, RuleMeta>,
  filesContent: Map<string, string>,
  scannedFiles: ReadonlySet<string>,
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

  // Second line of defence behind passing an explicit file list: a finding may
  // only name a file the scan actually walked. Reporting one from anywhere
  // else — a dependency's shipped .js, a build artifact — is worse than
  // missing it, because the developer cannot act on code they do not own.
  if (!scannedFiles.has(relFile)) return null;

  const span = d.labels?.[0]?.span;
  const line = typeof span?.line === 'number' ? span.line : 1;
  const column = typeof span?.column === 'number' ? span.column : 1;
  const endLine = typeof span?.endLine === 'number' ? span.endLine : undefined;
  const endColumn = typeof span?.endColumn === 'number' ? span.endColumn : undefined;

  const content = filesContent.get(relFile) ?? '';
  const snippet = content.split(/\r?\n/)[line - 1]?.trim() ?? '';

  // Rules with per-occurrence facts (e.g. the installed SDK version) opt in
  // to shipping the message they rendered at lint time.
  const message =
    meta.dynamicMessage && typeof d.message === 'string' && d.message
      ? d.message
      : meta.message;

  // Compatibility findings carry a hand-written verification hint. The lint
  // diagnostic is only a string, so the hint is recovered from the removal the
  // message names rather than threaded through oxlint. Scoped to the category
  // so no other rule's message can ever resolve one.
  const verifyHint =
    getRuleDocsMeta(ruleKey)?.category === 'compatibility'
      ? verifyHintFromMessage(message)
      : undefined;

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
    message,
    fix: meta.fix,
    docsUrl: meta.docsUrl,
    ...(verifyHint ? { verifyHint } : {}),
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
  if (input.clientBindings && Object.keys(input.clientBindings).length > 0) {
    try {
      clientMapPath = join(tmpDir, 'client-modules.json');
      writeFileSync(clientMapPath, JSON.stringify(input.clientBindings), 'utf-8');
    } catch {
      clientMapPath = undefined; // never let this break a scan
    }
  }

  try {
    // Lint exactly the files scanner.ts walked — never `.`.
    //
    // Passing a directory makes oxlint do its own walk, and its ignore
    // handling does not reliably exclude node_modules when a JS plugin is
    // registered (oxlint 1.68: `ignorePatterns` had no effect on a real
    // install, so every dependency's shipped .js was linted and reported).
    // That produced findings in files the scan never opened, in a report whose
    // own filesScanned count said otherwise.
    //
    // The deeper point is that there were two answers to "what gets scanned":
    // scanner.ts's walk, and oxlint's. The walk is the one that skips dot
    // directories, applies SKIP_DIR_NAMES and classifies language, and it is
    // the one whose count the report prints — so it is the only one that may
    // decide. ignorePatterns stays in the config as a second line of defence,
    // not as the mechanism.
    const results: ScanResult[] = [];
    const scannedFiles = new Set(input.files);
    for (const batch of batchFileArgs(input.files)) {
      const res = await runOxlint(
        oxlintBin,
        [
          '--config',
          configPath,
          '--format',
          'json',
          // A file deleted between the walk and the lint must not fail the run.
          '--no-error-on-unmatched-pattern',
          ...batch,
        ],
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

      for (const d of parsed.diagnostics ?? []) {
        const mapped = mapDiagnosticToResult(
          d,
          input.absRoot,
          input.ruleMetaByKey,
          input.filesContent,
          scannedFiles,
        );
        if (mapped) results.push(mapped);
      }
    }
    return results;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
