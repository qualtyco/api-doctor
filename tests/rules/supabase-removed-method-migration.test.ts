/**
 * The compatibility gate in migration mode.
 *
 * The same rule, the same removals, the comparison reversed — and the reversal
 * is the only thing `--migrate` changes. What matters here is that it is
 * reversed under exactly one condition and never any other: a project pinned to
 * v1 stays silent on an ordinary scan (already covered in
 * supabase-removed-method.test.ts) and speaks only when someone asks for a
 * target that crosses the removal.
 *
 * These run through oxlint with the real environment channel rather than by
 * calling the rule directly, because the channel is the part that could break.
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

/** `--migrate supabase@<major>` as the plugin receives it. */
function migrating(target: string, provider = 'supabase'): Record<string, string> {
  return { API_DOCTOR_MIGRATE: JSON.stringify({ provider, target, raw: `${provider}@${target}` }) };
}

const pinnedV1 = () => filesIn(`${ruleKey}-pinned-v1`);

describe('supabase-removed-method under --migrate', () => {
  it('flags the v1 project it stays silent on without a target', () => {
    const diags = pinnedV1().flatMap((f) => lintFileForRule(ruleKey, f, migrating('2.0.0')));
    expect(diags.length).toBeGreaterThan(0);

    // Without the target the very same files produce nothing — the fixture's
    // code is correct against its own pinned version.
    const silent = pinnedV1().flatMap((f) => lintFileForRule(ruleKey, f));
    expect(silent).toHaveLength(0);
  });

  it('speaks in the future tense and never claims the code is broken', () => {
    const messages = pinnedV1()
      .flatMap((f) => lintFileForRule(ruleKey, f, migrating('2.0.0')))
      .map((d: any) => d.message);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      // "was removed ... you have X installed" is the defect phrasing and must
      // not appear: nothing here is wrong yet.
      expect(message).not.toMatch(/was removed in/);
      expect(message).not.toMatch(/you have .* installed/);
      expect(message).not.toMatch(/upgrad/i);
      expect(message).toMatch(/ (becomes|is split into|is removed in|moves to) /);
    }
  });

  it('names the successor for a contract change, which the defect message withholds', () => {
    // Deliberate divergence from the backward path. A developer whose code is
    // already broken must not be handed a name that reads like a drop-in;
    // someone planning a move cannot plan toward an unnamed destination.
    const messages = pinnedV1()
      .flatMap((f) => lintFileForRule(ruleKey, f, migrating('2.0.0')))
      .map((d: any) => d.message);
    const userMessage = messages.find((m) => m.startsWith('auth.user '));
    expect(userMessage).toBeDefined();
    expect(userMessage).toContain('auth.getUser');
    expect(userMessage).toMatch(/different contract/);
  });

  it('stays silent when the target does not reach the removal', () => {
    // 1.35.7 → 1.9.0 crosses nothing that 2.0.0 removed.
    const diags = pinnedV1().flatMap((f) => lintFileForRule(ruleKey, f, migrating('1.9.0')));
    expect(diags).toHaveLength(0);
  });

  it('stays silent on a project already past the removal', () => {
    // The v2 fixture has nothing left to migrate TO 2.0.0. Its calls are
    // broken now, which is the scan's business, not the plan's.
    const diags = fixtureFiles(ruleKey, 'broken', 'supabase').flatMap((f) =>
      lintFileForRule(ruleKey, f, migrating('2.0.0')),
    );
    expect(diags).toHaveLength(0);
  });

  it('leaves other providers on the ordinary backward gate', () => {
    // Migrating tiptap must not change what the supabase rule means.
    const pinned = pinnedV1().flatMap((f) => lintFileForRule(ruleKey, f, migrating('3.0.0', 'tiptap')));
    expect(pinned).toHaveLength(0);

    const broken = fixtureFiles(ruleKey, 'broken', 'supabase').flatMap((f) =>
      lintFileForRule(ruleKey, f, migrating('3.0.0', 'tiptap')),
    );
    expect(broken.length).toBeGreaterThan(0);
    expect(broken.every((d: any) => /was removed in/.test(d.message))).toBe(true);
  });

  it('degrades a malformed target to ordinary backward behaviour', () => {
    // A broken env var must never be able to reverse the meaning of a scan.
    for (const bad of ['not json', '{}', '{"provider":"supabase"}', '[]']) {
      const pinned = pinnedV1().flatMap((f) =>
        lintFileForRule(ruleKey, f, { API_DOCTOR_MIGRATE: bad }),
      );
      expect(pinned, `expected silence for ${bad}`).toHaveLength(0);

      const broken = fixtureFiles(ruleKey, 'broken', 'supabase').flatMap((f) =>
        lintFileForRule(ruleKey, f, { API_DOCTOR_MIGRATE: bad }),
      );
      expect(broken.length, `expected backward findings for ${bad}`).toBeGreaterThan(0);
      expect(broken.every((d: any) => /was removed in/.test(d.message))).toBe(true);
    }
  });

  it('still requires a resolvable installed version', () => {
    // The -fixed fixture has migrated code; a target cannot conjure findings
    // out of calls that are already on the new names.
    const diags = fixtureFiles(ruleKey, 'fixed', 'supabase').flatMap((f) =>
      lintFileForRule(ruleKey, f, migrating('2.0.0')),
    );
    expect(diags).toHaveLength(0);
  });
});
