/**
 * Orchestrates a full project scan:
 * 1) walks source files and detects API providers/SDKs,
 * 2) enables matching oxlint rules from the bundled plugin,
 * 3) shells out to oxlint and parses JSON diagnostics,
 * 4) maps diagnostics into ScanResult objects for the reporter.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { join, relative, resolve } from 'node:path';
import { PLUGIN_NAME } from './constants.js';
import { detectProviders } from './detector.js';
import { providers } from './providers/index.js';
import type { DetectedProvider, OxlintRuleMeta, ScanResult } from './types.js';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next']);
const SOURCE_EXT = /\.(tsx?|jsx?)$/;

/**
 * Recursively walks a directory tree and collects relative paths to source files.
 * Skips hidden files/dirs (names starting with `.`) and dirs in SKIP_DIRS.
 * Mutates the `files` array in place — callers pass an empty array to fill.
 */
async function walk(dir: string, root: string, files: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, root, files);
    } else if (SOURCE_EXT.test(entry.name)) {
      files.push(relative(root, full));
    }
  }
}

/** Options passed from the CLI into `scan()`. */
export interface ScanOptions {
  /** When set, only run checks for these provider names (from `--provider`). */
  onlyProviders?: string[];
}

/** Return value of `scan()` — findings plus which SDKs were detected. */
export interface ScanOutput {
  results: ScanResult[];
  detected: DetectedProvider[];
  /** Absolute path that was scanned. */
  directory: string;
  /** Number of source files walked. */
  filesScanned: number;
  /** Relative file path -> file contents, for snippet extraction downstream. */
  filesContent: Map<string, string>;
}

/** Thrown on tool-level failures (unreadable directory, oxlint crash). Maps to exit 2. */
export class ScanError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ScanError';
  }
}

/**
 * Builds the oxlint config for a scan based on which providers were detected.
 * Returns two things:
 *   - oxlintRules: rule ids → severity, written into the temp .oxlintrc.json
 *   - ruleMetaByKey: rule key → message/fix/docs, used when mapping diagnostics back
 */
function buildOxlintConfig(detectedNames: Set<string>): {
  oxlintRules: Record<string, 'error' | 'warn' | 'off'>;
  ruleMetaByKey: Map<string, OxlintRuleMeta>;
} {
  const oxlintRules: Record<string, 'error' | 'warn' | 'off'> = {};
  const ruleMetaByKey = new Map<string, OxlintRuleMeta>();

  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule of provider.oxlintRules) {
      // oxlint has no `info` level; warnings and info both map to `warn`.
      // The declared severity is preserved in ruleMetaByKey for reporting.
      oxlintRules[`${PLUGIN_NAME}/${rule.key}`] =
        rule.severity === 'error' || rule.severity === undefined ? 'error' : 'warn';
      ruleMetaByKey.set(rule.key, rule);
    }
  }

  return { oxlintRules, ruleMetaByKey };
}

export async function scan(directory: string, options: ScanOptions = {}): Promise<ScanOutput> {
  // Resolve the target directory to an absolute path.
  const absRoot = resolve(directory);

  // Collect every .ts/.tsx/.js/.jsx file under absRoot (skipping node_modules, etc.).
  const paths: string[] = [];
  try {
    await walk(absRoot, absRoot, paths);
  } catch (err) {
    throw new ScanError(`Could not read directory: ${absRoot}`, err);
  }

  // Read each file's contents into memory — used for provider detection and line snippets.
  const filesContent = new Map<string, string>();
  for (const rel of paths) {
    const content = await readFile(join(absRoot, rel), 'utf-8');
    filesContent.set(rel, content);
  }

  // Detect which API SDKs are present (package.json deps, imports, URL patterns).
  let detected = await detectProviders(absRoot, filesContent);

  // If --provider was passed, narrow detection to only those providers.
  if (options.onlyProviders?.length) {
    const allowed = new Set(options.onlyProviders.map((p) => p.toLowerCase()));
    detected = detected.filter((d) => allowed.has(d.name));
  }

  // Look up which oxlint rules to enable based on detected providers.
  const detectedNames = new Set(detected.map((d) => d.name));
  const { oxlintRules, ruleMetaByKey } = buildOxlintConfig(detectedNames);

  // Nothing to lint — e.g. no supported SDK found, or provider has no rules yet.
  if (Object.keys(oxlintRules).length === 0) {
    return {
      results: [],
      detected,
      directory: absRoot,
      filesScanned: paths.length,
      filesContent,
    };
  }

  // Resolve the bundled oxlint plugin on disk (dist/plugin.js).
  const require = createRequire(import.meta.url);
  const pluginEntry = require.resolve('api-doctor/plugin');

  // Write a temporary oxlint config — we don't require users to have one in their project.
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'api-doctor-oxlint-'));
  const configPath = join(tmpDir, 'oxlintrc.json');

  const config = {
    jsPlugins: [pluginEntry],
    rules: oxlintRules,
    ignorePatterns: Array.from(SKIP_DIRS),
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  // Run oxlint against the target project; diagnostics come back as JSON on stdout.
  const res = spawnSync(
    'npx',
    ['oxlint', '--config', configPath, '--format', 'json', '.'],
    {
      cwd: absRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  try {
    // spawnSync sets `error` when the process couldn't start at all.
    if (res.error) {
      throw new ScanError('Failed to run oxlint', res.error);
    }
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
    const diagnostics: any[] = parsed.diagnostics ?? [];

    // Convert oxlint diagnostics into ScanResult objects for the reporter.
    const results: ScanResult[] = [];
    for (const d of diagnostics) {
      const code = String(d.code ?? '');
      // Skip built-in oxlint rules (e.g. no-unused-vars) — only keep our plugin rules.
      const matched = [...ruleMetaByKey.entries()].find(([key]) => code.includes(key));
      if (!matched) continue;
      const [ruleKey, meta] = matched;

      // Normalize the file path to be relative to the scanned directory.
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

      // Pull the offending source line for --verbose output.
      const content = filesContent.get(relFile) ?? '';
      const snippet = content.split(/\r?\n/)[line - 1]?.trim() ?? '';

      results.push({
        file: relFile,
        line,
        column,
        endLine,
        endColumn,
        snippet,
        ruleKey,
        rule: meta.resultRule,
        // The manifest declares the intended severity (including `info`, which
        // oxlint reports as a warning). Fall back to oxlint's severity.
        severity: meta.severity ?? (d.severity === 'warning' ? 'warning' : 'error'),
        message: meta.message,
        fix: meta.fix,
        docsUrl: meta.docsUrl,
      });
    }

    return {
      results,
      detected,
      directory: absRoot,
      filesScanned: paths.length,
      filesContent,
    };
  } finally {
    // Clean up the temp config directory regardless of success or failure.
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
