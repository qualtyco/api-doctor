/**
 * agentmail-removed-method (compatibility)
 *
 * metrics.query became queryEvents + queryUsage in 0.5.12, and the two hit
 * different endpoints — so the finding must present as a split, never as a
 * rename with a drop-in replacement.
 */
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureDir, fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'agentmail-removed-method';

function filesIn(dirName: string): string[] {
  const dir = join(fixtureDir(ruleKey, 'broken', 'agentmail'), '..', dirName);
  return readdirSync(dir)
    .filter((n) => /\.(tsx?|jsx?)$/.test(n))
    .sort()
    .map((n) => join(dir, n));
}

describe('agentmail-removed-method rule', () => {
  it('flags metrics.query when the installed version no longer has it (0.5.20)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /^metrics\.query was removed in 0\.5\.12/.test(d.message))).toBe(true);
      expect(diags.some((d: any) => /you have 0\.5\.20 installed/.test(d.message))).toBe(true);
      expect(diags.every((d: any) => !/upgrad|newer version/i.test(d.message))).toBe(true);
    }
  });

  it('presents a split as a split, never as a drop-in rename', () => {
    const [file] = fixtureFiles(ruleKey, 'broken', 'agentmail');
    const [diag] = lintFileForRule(ruleKey, file);
    expect(diag.message).toMatch(/split into metrics\.queryEvents, metrics\.queryUsage/);
    expect(diag.message).toMatch(/depends on the arguments/);
    // The wire-identical wording is reserved for calls that really are identical.
    expect(diag.message).not.toMatch(/Same request, same arguments/);
  });

  it('matches the same path on a nested resource client', () => {
    const nested = fixtureFiles(ruleKey, 'broken', 'agentmail').find((f) => f.includes('inbox-metrics'));
    expect(nested).toBeDefined();
    expect(lintFileForRule(ruleKey, nested!).length).toBeGreaterThanOrEqual(1);
  });

  it('stays silent on the migrated calls, and on a same-named non-SDK receiver', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'agentmail')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });

  it('stays silent when the project is pinned to 0.5.11', () => {
    for (const file of filesIn(`${ruleKey}-pinned-old`)) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
