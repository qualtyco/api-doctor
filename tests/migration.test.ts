/**
 * The migration mode's pure parts: target parsing, the difficulty derivation,
 * and the shape of the plan.
 *
 * The invariants under test are the ones that separate a plan from a defect
 * report. Nothing here may read as an upgrade recommendation, difficulty must
 * come from the removal's own verified facts rather than from anything a
 * provider declares about itself, and the file has to explain what it is to a
 * reader who has no api-doctor skill installed.
 */
import { describe, expect, it } from 'vitest';
import {
  buildMigrationReport,
  describeDestination,
  difficultyOf,
  DIFFICULTY_ORDER,
  everyRemovalOf,
  highestRemovedIn,
  migrationFileName,
  parseMigrationTarget,
  suggestTarget,
} from '../src/migration.js';
import { compareSemver } from '../src/plugin/installed-version.js';
import { providers } from '../src/providers/index.js';
import type { MethodRemoval, ScanResult, SymbolRemoval } from '../src/types.js';

const supabase = providers.find((p) => p.name === 'supabase')!;

function result(over: Partial<ScanResult> & { message: string }): ScanResult {
  return {
    file: 'src/a.ts',
    line: 1,
    column: 1,
    snippet: '',
    ruleKey: 'supabase-removed-method',
    rule: 'supabase/removed-method',
    severity: 'error',
    fix: '',
    ...over,
  };
}

describe('parseMigrationTarget', () => {
  it('pads a partial version UP, so `@2` means the whole 2.x line', () => {
    // Padding down to 2.0.0 is the bug this asserts against: most SDKs do not
    // break exactly at x.0.0, and a downward bound reports "nothing changes"
    // at a project with work ahead of it.
    expect(parseMigrationTarget('supabase@2')).toEqual({
      provider: 'supabase',
      target: '2.999999.999999',
      label: '2.x',
      raw: 'supabase@2',
    });
    expect(parseMigrationTarget('supabase@2.4')).toMatchObject({
      target: '2.4.999999',
      label: '2.4.x',
    });
    // An exact three-part version is a precise request and is left alone.
    expect(parseMigrationTarget('supabase@2.0.0')).toMatchObject({
      target: '2.0.0',
      label: '2.0.0',
    });
    expect(parseMigrationTarget('SUPABASE@2')).toMatchObject({ provider: 'supabase' });
  });

  it('reaches every shipped removal from the target it suggests', () => {
    // The regression guard for the whole family: tiptap removes at 3.0.1, s2 at
    // 0.24.0, agentmail at 0.5.12. None of those is an x.0.0, so a suggestion
    // that does not reach them is a flag that silently does nothing.
    for (const provider of providers.filter((p) => p.compatibility)) {
      const parsed = parseMigrationTarget(`${provider.name}@${suggestTarget(provider)}`);
      expect(parsed, provider.name).not.toHaveProperty('error');
      const { target } = parsed as { target: string };
      for (const removal of everyRemovalOf(provider)) {
        expect(
          compareSemver(target, removal.removedIn)! >= 0,
          `${provider.name}@${suggestTarget(provider)} must reach ${removal.removedIn}`,
        ).toBe(true);
      }
    }
  });

  it('suggests the minor on a 0.x package, where the major says nothing', () => {
    expect(suggestTarget(providers.find((p) => p.name === 's2')!)).toBe('0.24');
    expect(suggestTarget(providers.find((p) => p.name === 'agentmail')!)).toBe('0.5');
    expect(suggestTarget(supabase)).toBe('2');
  });

  it('rejects a provider with no verified compatibility data', () => {
    // Without removals there is nothing to plan, and an empty plan reads as
    // "you have no work to do" — a worse answer than saying so outright.
    const withoutData = providers.find((p) => !p.compatibility)!;
    const parsed = parseMigrationTarget(`${withoutData.name}@2`);
    expect(parsed).toHaveProperty('error');
    expect((parsed as { error: string }).error).toMatch(/no verified compatibility data/);
  });

  it('rejects unknown providers, missing versions, and non-versions', () => {
    expect(parseMigrationTarget('nope@2')).toHaveProperty('error');
    expect(parseMigrationTarget('supabase')).toHaveProperty('error');
    expect(parseMigrationTarget('supabase@next')).toHaveProperty('error');
    expect(parseMigrationTarget('supabase@2.0.0.1')).toHaveProperty('error');
    expect(parseMigrationTarget('  ')).toHaveProperty('error');
  });

  it('suggests a target that actually removes something', () => {
    const err = (parseMigrationTarget('supabase') as { error: string }).error;
    expect(err).toContain('supabase@2');
  });
});

describe('difficultyOf', () => {
  const facts = {
    removedIn: '2.0.0',
    verifiedAt: '2026-01-01',
    evidence: 'x',
    verifyHint: 'y',
  };

  it('lets only a wire-identical rename count as mechanical', () => {
    expect(
      difficultyOf({ ...facts, path: 'a', kind: 'rename', wireIdentical: true } as MethodRemoval),
    ).toBe('mechanical');
    // The same kind without the verified wire claim is NOT mechanical. This is
    // the guard that stops a provider grading its own migration as easier than
    // it is: wireIdentical is the only field that licenses bulk application.
    expect(
      difficultyOf({ ...facts, path: 'a', kind: 'rename', wireIdentical: false } as MethodRemoval),
    ).toBe('behavior-check');
  });

  it('maps each remaining kind to the judgement it needs', () => {
    const of = (kind: MethodRemoval['kind']) =>
      difficultyOf({ ...facts, path: 'a', kind, wireIdentical: false } as MethodRemoval);
    expect(of('split')).toBe('argument-dependent');
    expect(of('signature-change')).toBe('restructure');
    expect(of('removed')).toBe('decision-required');
  });

  it('grades every shipped removal, and lands in the known order', () => {
    for (const provider of providers.filter((p) => p.compatibility)) {
      for (const removal of everyRemovalOf(provider)) {
        expect(DIFFICULTY_ORDER).toContain(difficultyOf(removal));
      }
    }
  });
});

describe('highestRemovedIn', () => {
  it('is the highest version at which the provider removes anything', () => {
    expect(highestRemovedIn(supabase)).toBe('2.0.0');
  });
});

describe('buildMigrationReport', () => {
  const target = {
    provider: 'supabase',
    target: '2.999999.999999',
    label: '2.x',
    raw: 'supabase@2',
  };
  const filesContent = new Map([['src/a.ts', 'a\nb\nc\n']]);

  function build(results: ScanResult[]) {
    return buildMigrationReport({
      target,
      packageName: '@supabase/supabase-js',
      installed: '1.35.7',
      results,
      directory: '/tmp/p',
      filesContent,
      version: '0.0.0',
      generatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  it('displays the human label and prunes on the exact finished version', () => {
    const report = build([
      result({ message: 'auth.setAuth is removed in 2.0.0 with no successor.' }),
    ]);
    // `to` is what a person reads; `completedAt` is what prune compares.
    expect(report.to).toBe('2.x');
    expect(report.completedAt).toBe('2.0.0');
    expect(build([]).completedAt).toBeUndefined();
  });

  it('says what it is, so an agent can read it without an installed skill', () => {
    const report = build([]);
    expect(report.kind).toBe('migration');
    expect(report.instructions.join('\n')).toMatch(/MIGRATION PLAN, not a defect report/);
    // Names the other file and its discriminator: the two must not be confused.
    expect(report.instructions.join('\n')).toContain('kind: "scan"');
  });

  it('never tells the reader to upgrade', () => {
    const report = build([
      result({ message: 'auth.update becomes auth.updateUser in 2.0.0 — a rename, same request and same arguments.' }),
    ]);
    const prose = [...report.instructions, ...report.groups.flatMap((g) => [g.title, g.guidance])].join('\n');
    expect(prose).not.toMatch(/you should upgrade|out of date|outdated|upgrade now/i);
    // It says the opposite, in fact: the bump is the developer's to make.
    expect(prose).toMatch(/Do not upgrade the package yourself/);
  });

  it('groups call sites under their change, in work order', () => {
    const report = build([
      result({ message: 'auth.setAuth is removed in 2.0.0 with no successor.', file: 'src/a.ts', line: 3 }),
      result({ message: 'auth.update becomes auth.updateUser in 2.0.0 — a rename, same request and same arguments.', line: 1 }),
      result({ message: 'auth.update becomes auth.updateUser in 2.0.0 — a rename, same request and same arguments.', line: 2 }),
    ]);

    expect(report.summary.changes).toBe(2);
    expect(report.summary.sites).toBe(3);
    // Mechanical before decision-required, always.
    expect(report.groups.map((g) => g.difficulty)).toEqual(['mechanical', 'decision-required']);
    const [mechanical] = report.groups;
    expect(mechanical.changes).toHaveLength(1);
    expect(mechanical.changes[0].sites.map((s) => s.line)).toEqual([1, 2]);
    expect(mechanical.changes[0].to).toBe('auth.updateUser');
  });

  it('carries the split successors without choosing between them', () => {
    const report = build([
      result({
        message:
          'auth.signIn is split into auth.signInWithPassword, auth.signInWithOtp in 2.0.0; which one applies depends on the arguments at this call site.',
      }),
    ]);
    const change = report.groups[0].changes[0];
    expect(change.to).toBeUndefined();
    expect(change.toOptions).toContain('auth.signInWithPassword');
    expect(change.verify).toMatch(/depends on the arguments/);
  });

  it('drops a message naming nothing known rather than guessing at it', () => {
    const report = build([
      result({ message: 'somethingElse was removed in 9.0.0 — you have 1.0.0 installed.' }),
    ]);
    expect(report.summary.sites).toBe(0);
    expect(report.groups).toHaveLength(0);
  });

  it('carries the hand-written verify note onto every change', () => {
    const report = build([
      result({ message: 'auth.user becomes auth.getUser in 2.0.0, with a different contract — read the Verify line before rewriting this call.' }),
    ]);
    expect(report.groups[0].changes[0].verify.length).toBeGreaterThan(20);
  });
});

describe('migrationFileName', () => {
  it('is one plan per provider', () => {
    expect(migrationFileName('supabase')).toBe('migration-supabase.json');
    expect(migrationFileName('tiptap')).toBe('migration-tiptap.json');
  });
});

describe('shipped compatibility data', () => {
  it('every removal is gradeable and every provider states a package', () => {
    for (const provider of providers.filter((p) => p.compatibility)) {
      expect(provider.compatibility!.package, provider.name).toBeTruthy();
      const removals: Array<SymbolRemoval | MethodRemoval> = everyRemovalOf(provider);
      expect(removals.length, provider.name).toBeGreaterThan(0);
    }
  });
});

describe('describeDestination', () => {
  const base = {
    id: 'x',
    from: 'BubbleMenu',
    kind: 'moved' as const,
    difficulty: 'behavior-check' as const,
    removedIn: '3.0.1',
    wireIdentical: false,
    verify: 'v',
    sites: [],
  };

  it('names the module for a moved symbol, not its unchanged name', () => {
    // `BubbleMenu → BubbleMenu` is what a replacement-first reading produces,
    // and it hides the only thing that changed.
    expect(describeDestination({ ...base, to: 'BubbleMenu', movedTo: '@tiptap/react/menus' }))
      .toBe("import from '@tiptap/react/menus'");
    expect(describeDestination({ ...base, to: 'Bubble', movedTo: '@tiptap/react/menus' }))
      .toBe("Bubble from '@tiptap/react/menus'");
  });

  it('covers the remaining shapes', () => {
    expect(describeDestination({ ...base, to: 'auth.getUser' })).toBe('auth.getUser');
    expect(describeDestination({ ...base, toOptions: ['a', 'b'] })).toBe('a | b');
    expect(describeDestination(base)).toBe('no successor');
  });
});
