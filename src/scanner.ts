/**
 * Orchestrates a full project scan:
 * 1) walks source files and classifies each by language,
 * 2) detects API providers/SDKs,
 * 3) collects JS SDK surface coverage (informational),
 * 4) runs the JS (oxlint) engine,
 * 5) merges diagnostics into ScanResult objects for the reporter.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { SKIP_DIR_NAMES } from './constants.js';
import { collectClientBindings, collectCoverage } from './coverage/collect.js';
import { detectProviders } from './detector.js';
import { classifyFileLanguage, isJavascriptFile } from './engines/classify.js';
import { buildJsRuleConfig, runJsEngine } from './engines/js/runner.js';
import { getRuleDocsMeta } from './plugin/rule-registry.js';
import { ScanError } from './scan-error.js';
import type {
  CoverageCollection,
  DetectedProvider,
  MigrationTarget,
  RuleLanguage,
  ScanResult,
} from './types.js';

export { ScanError } from './scan-error.js';

export const SKIP_DIRS = new Set(SKIP_DIR_NAMES);

async function walk(
  dir: string,
  root: string,
  files: string[],
  isRoot = false,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (isRoot) throw err;
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, root, files);
    } else if (classifyFileLanguage(entry.name) !== null) {
      files.push(relative(root, full));
    }
  }
}

export interface ScanOptions {
  onlyProviders?: string[];
  /**
   * Set only by a `--migrate` run. It narrows the scan to that provider's
   * compatibility rules and reverses their version gate, so what comes back is
   * a list of calls that work today and would not after the move.
   *
   * Narrowing is deliberate. A migration run is answering one question, and
   * carrying the other 100-odd correctness rules through it would mean a plan
   * file that mixes "this would break on upgrade" with "this is wrong now" —
   * exactly the confusion the two separate reports exist to prevent.
   */
  migrate?: MigrationTarget;
}

export interface ScanOutput {
  results: ScanResult[];
  detected: DetectedProvider[];
  rawPackages: string[];
  directory: string;
  filesScanned: number;
  filesContent: Map<string, string>;
  coverage?: CoverageCollection[];
  languagesScanned: RuleLanguage[];
}

export async function scan(directory: string, options: ScanOptions = {}): Promise<ScanOutput> {
  const absRoot = resolve(directory);

  const paths: string[] = [];
  try {
    await walk(absRoot, absRoot, paths, true);
  } catch (err) {
    throw new ScanError(`Could not read directory: ${absRoot}`, err);
  }

  const filesContent = new Map<string, string>();
  for (const rel of paths) {
    filesContent.set(rel, await readFile(join(absRoot, rel), 'utf-8'));
  }

  const jsFiles = paths.filter(isJavascriptFile);
  const languagesScanned: RuleLanguage[] = [];
  if (jsFiles.length) languagesScanned.push('javascript');

  // Coverage uses oxc-parser — only feed JS/TS sources.
  const jsFilesContent = new Map(
    [...filesContent.entries()].filter(([path]) => isJavascriptFile(path)),
  );

  let { detected, rawPackages } = await detectProviders(absRoot, filesContent);

  if (options.onlyProviders?.length) {
    const allowed = new Set(options.onlyProviders.map((p) => p.toLowerCase()));
    detected = detected.filter((d) => allowed.has(d.name));
  }

  if (options.migrate) {
    detected = detected.filter((d) => d.name === options.migrate!.provider);
  }

  const coverage = collectCoverage(detected, jsFilesContent);

  // Verified client identities per file, including clients constructed in one
  // module and imported into another. Passed to the JS engine so the lint
  // plugin can recognise them; purely additive.
  const clientBindings = collectClientBindings(detected, jsFilesContent);

  const detectedNames = new Set(detected.map((d) => d.name));
  let { ruleMetaByKey: jsRules } = buildJsRuleConfig(detectedNames);

  if (options.migrate) {
    jsRules = new Map(
      [...jsRules].filter(([key]) => getRuleDocsMeta(key)?.category === 'compatibility'),
    );
  }

  const results: ScanResult[] = [];

  if (jsFiles.length > 0 && jsRules.size > 0) {
    results.push(
      ...(await runJsEngine({
        absRoot,
        files: jsFiles,
        filesContent,
        detectedNames,
        ruleMetaByKey: jsRules,
        clientBindings,
        migrate: options.migrate,
      })),
    );
  }

  return {
    results,
    detected,
    rawPackages,
    directory: absRoot,
    filesScanned: paths.length,
    filesContent,
    coverage,
    languagesScanned,
  };
}
