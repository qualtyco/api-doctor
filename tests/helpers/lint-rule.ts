/**
 * Shared helper for rule tests: runs oxlint with only the given plugin rule
 * enabled against a single file, and returns the diagnostics for that rule.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_NAME } from '../../src/constants.js';

// Same spawn strategy as scanner.ts: run oxlint's JS bin under our own Node
// binary — the .bin shim is a .CMD on Windows, which spawn refuses without a
// shell since Node's CVE-2024-27980 fix (EINVAL).
const require = createRequire(import.meta.url);
const oxlintPkgPath = require.resolve('oxlint/package.json');
const oxlintBin = join(dirname(oxlintPkgPath), require(oxlintPkgPath).bin.oxlint);
const pluginDist = join(process.cwd(), 'dist/plugin.js');

const testsDir = dirname(dirname(fileURLToPath(import.meta.url)));

/** Absolute path to a fixture directory for a rule, e.g. `<rule>-broken`. */
export function fixtureDir(
  ruleKey: string,
  kind: 'broken' | 'fixed',
  provider = 'resend',
): string {
  return join(testsDir, 'fixtures', provider, `${ruleKey}-${kind}`);
}

/** Absolute paths of every fixture file in a rule's broken/fixed directory. */
export function fixtureFiles(
  ruleKey: string,
  kind: 'broken' | 'fixed',
  provider = 'resend',
): string[] {
  const dir = fixtureDir(ruleKey, kind, provider);
  return readdirSync(dir)
    .filter((name) => /\.(tsx?|jsx?)$/.test(name))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * Lints a single file with only `<plugin>/<ruleKey>` enabled (as an error so
 * oxlint always emits it), and returns diagnostics belonging to that rule.
 */
export function lintFileForRule(ruleKey: string, filePath: string): any[] {
  const ruleId = `${PLUGIN_NAME}/${ruleKey}`;
  const tmp = mkdtempSync(join(os.tmpdir(), 'api-doctor-oxlint-'));
  const configPath = join(tmp, 'oxlintrc.json');
  writeFileSync(
    configPath,
    JSON.stringify(
      // Alias form pins the plugin name to PLUGIN_NAME; without it oxlint
      // derives the name from the surrounding package (`@api-doctor/cli`)
      // and no `api-doctor/<rule>` id resolves.
      { jsPlugins: [{ name: PLUGIN_NAME, specifier: pluginDist }], rules: { [ruleId]: 'error' } },
      null,
      2,
    ),
    'utf-8',
  );

  const res = spawnSync(
    process.execPath,
    [oxlintBin, '-c', configPath, '--format', 'json', filePath],
    { encoding: 'utf8' },
  );

  try {
    const parsed = JSON.parse(res.stdout);
    const diagnostics: any[] = parsed.diagnostics ?? [];
    return diagnostics.filter((d: any) => String(d.code ?? '').includes(ruleKey));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
