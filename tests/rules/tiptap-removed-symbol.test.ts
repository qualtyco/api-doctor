/**
 * tiptap-removed-symbol (compatibility)
 *
 * BubbleMenu/FloatingMenu left the @tiptap/react root in 3.0.1 for the
 * @tiptap/react/menus subpath. The interesting case here is not the finding
 * but its opposite: the correct v3 import lives UNDER the package the removals
 * belong to, so a detector that prefix-matched the package name would flag the
 * very line that fixes the problem.
 */
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureDir, fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'tiptap-removed-symbol';

/** Fixture dirs outside the broken/fixed pair the helper knows about. */
function filesIn(dirName: string): string[] {
  const dir = join(fixtureDir(ruleKey, 'broken', 'tiptap'), '..', dirName);
  return readdirSync(dir)
    .filter((n) => /\.(tsx?|jsx?)$/.test(n))
    .sort()
    .map((n) => join(dir, n));
}

describe('tiptap-removed-symbol rule', () => {
  it('flags the v2 root import when v3 is installed (3.30.2)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'tiptap')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.some((d: any) => /was removed from '@tiptap\/react' in 3\.0\.1/.test(d.message))).toBe(true);
      expect(diags.some((d: any) => /you have 3\.30\.2 installed/.test(d.message))).toBe(true);
      // The message must point at the module, since the symbol name is unchanged.
      expect(diags.some((d: any) => /@tiptap\/react\/menus/.test(d.message))).toBe(true);
      // Never an upgrade nudge.
      expect(diags.every((d: any) => !/upgrad|newer version/i.test(d.message))).toBe(true);
    }
  });

  it('names both components across the fixture', () => {
    const all = fixtureFiles(ruleKey, 'broken', 'tiptap').flatMap((f) => lintFileForRule(ruleKey, f));
    expect(all.some((d: any) => /^BubbleMenu /.test(d.message))).toBe(true);
    expect(all.some((d: any) => /^FloatingMenu /.test(d.message))).toBe(true);
  });

  it('stays silent on the migrated subpath import — the module that fixes it', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'tiptap')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });

  it('stays silent when the project is pinned to Tiptap 2', () => {
    for (const file of filesIn(`${ruleKey}-pinned-v2`)) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
