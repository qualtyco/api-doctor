/**
 * browserbase-removed-method (compatibility)
 *
 * The 1.x flat client became a 2.x resource client. Several of these really
 * are wire-identical renames and are allowed to say so; the ones that changed
 * arguments or dropped a retry loop must not.
 */
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureDir, fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'browserbase-removed-method';

function filesIn(dirName: string): string[] {
  const dir = join(fixtureDir(ruleKey, 'broken', 'browserbase'), '..', dirName);
  return readdirSync(dir)
    .filter((n) => /\.(tsx?|jsx?)$/.test(n))
    .sort()
    .map((n) => join(dir, n));
}

function allBroken(): any[] {
  return fixtureFiles(ruleKey, 'broken', 'browserbase').flatMap((f) => lintFileForRule(ruleKey, f));
}

describe('browserbase-removed-method rule', () => {
  it('flags 1.x client calls when 2.x is installed (2.18.0)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.every((d: any) => /you have 2\.18\.0 installed/.test(d.message))).toBe(true);
      expect(diags.every((d: any) => !/upgrad|newer version/i.test(d.message))).toBe(true);
    }
  });

  it('covers every removed path the fixture exercises', () => {
    const messages = allBroken().map((d: any) => d.message);
    for (const path of [
      'createSession',
      'listSessions',
      'getSession',
      'completeSession',
      'getSessionLogs',
      'getSessionRecording',
      'getSessionDownloads',
      'getDebugConnectionURLs',
      'getConnectURL',
    ]) {
      expect(
        messages.some((m) => m.startsWith(`${path} was removed in 2.0.0`)),
        `expected a finding for ${path}`,
      ).toBe(true);
    }
  });

  it('claims wire-identical only where both builders were verified identical', () => {
    const messages = allBroken();
    const find = (path: string) => messages.find((d: any) => d.message.startsWith(`${path} `))!.message;

    // Verified identical: same verb, same path, same single argument.
    expect(find('listSessions')).toMatch(/Renamed to sessions\.list\. Same request, same arguments\./);
    expect(find('getSession')).toMatch(/Renamed to sessions\.retrieve\. Same request, same arguments\./);
    expect(find('getSessionLogs')).toMatch(/Renamed to sessions\.logs\.list\./);

    // Arguments changed, or a retry loop disappeared — must NOT read as a
    // drop-in rename even though the request line is the same.
    for (const path of ['createSession', 'completeSession', 'getSessionDownloads']) {
      expect(find(path), path).not.toMatch(/Same request, same arguments/);
    }
    // No successor at all.
    expect(find('getConnectURL')).toBe(
      'getConnectURL was removed in 2.0.0 — you have 2.18.0 installed.',
    );
  });

  it('stays silent on migrated code and on a same-named non-SDK receiver', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'browserbase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });

  it('stays silent when the project is pinned to 1.x', () => {
    for (const file of filesIn(`${ruleKey}-pinned-v1`)) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
