/**
 * supabase-removed-method (compatibility)
 *
 * The v1 → v2 auth and realtime break. Two things matter beyond "it fires":
 * the receiver must be traced to the SDK (a project's own `auth.signIn()`
 * facade in a Supabase file must not match), and a project pinned to v1 must
 * stay silent forever.
 */
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtureDir, fixtureFiles, lintFileForRule } from '../helpers/lint-rule.js';

const ruleKey = 'supabase-removed-method';

function filesIn(dirName: string): string[] {
  const dir = join(fixtureDir(ruleKey, 'broken', 'supabase'), '..', dirName);
  return readdirSync(dir)
    .filter((n) => /\.(tsx?|jsx?)$/.test(n))
    .sort()
    .map((n) => join(dir, n));
}

function allBroken(): any[] {
  return fixtureFiles(ruleKey, 'broken', 'supabase').flatMap((f) => lintFileForRule(ruleKey, f));
}

describe('supabase-removed-method rule', () => {
  it('flags v1 auth and realtime calls when v2 is installed (2.112.3)', () => {
    for (const file of fixtureFiles(ruleKey, 'broken', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags.length, `expected a diagnostic in ${file}`).toBeGreaterThanOrEqual(1);
      expect(diags.every((d: any) => /you have 2\.112\.3 installed/.test(d.message))).toBe(true);
      expect(diags.every((d: any) => !/upgrad|newer version/i.test(d.message))).toBe(true);
    }
  });

  it('covers every removed path the fixture exercises', () => {
    const messages = allBroken().map((d: any) => d.message);
    for (const path of [
      'auth.signIn',
      'auth.user',
      'auth.session',
      'auth.update',
      'auth.verifyOTP',
      'auth.setAuth',
      'removeSubscription',
      'getSubscriptions',
      'removeAllSubscriptions',
    ]) {
      expect(
        messages.some((m) => m.startsWith(`${path} was removed in 2.0.0`)),
        `expected a finding for ${path}`,
      ).toBe(true);
    }
  });

  it('describes each removal in the terms its own change deserves', () => {
    const messages = allBroken();
    const find = (path: string) => messages.find((d: any) => d.message.startsWith(`${path} `))!.message;

    // A split lists its successors and refuses to pick one.
    expect(find('auth.signIn')).toMatch(/split into .*signInWithPassword/);
    expect(find('auth.signIn')).toMatch(/depends on the arguments/);
    // A verified wire-identical rename may say so; a behaviour change may not.
    expect(find('auth.update')).toMatch(/Renamed to auth\.updateUser\. Same request, same arguments\./);
    expect(find('auth.user')).not.toMatch(/Same request, same arguments/);
    // A removal with no successor promises nothing.
    expect(find('auth.setAuth')).toBe(
      'auth.setAuth was removed in 2.0.0 — you have 2.112.3 installed.',
    );
  });

  it('stays silent on migrated code and on a same-named non-SDK receiver', () => {
    for (const file of fixtureFiles(ruleKey, 'fixed', 'supabase')) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });

  it('stays silent when the project is pinned to v1', () => {
    for (const file of filesIn(`${ruleKey}-pinned-v1`)) {
      const diags = lintFileForRule(ruleKey, file);
      expect(diags, `unexpected diagnostic in ${file}`).toHaveLength(0);
    }
  });
});
