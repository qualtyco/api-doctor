import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearInstalledVersionCache } from '../src/plugin/installed-version.js';
import { providers } from '../src/providers/index.js';
import { s2Manifest } from '../src/providers/s2/manifest.js';
import { resolveProviderVersions } from '../src/sdk-versions.js';
import type { DetectedProvider } from '../src/types.js';

// A provider with a surface but no hand-verified baseline, picked from the
// registry rather than named. Baselines get added over time (that is the point
// of `pnpm sdk:watch`), and this test is about the no-baseline branch of
// resolveProviderVersions, not about which provider happens to lack one.
// Skips rather than fails if every provider is eventually verified.
const unverified = providers.find((p) => p.surface && !p.surface.verified);

// S2 is the only provider carrying surface.verified today. Read the baseline
// from the manifest rather than pinning the literal: re-verifying the surface
// against a newer SDK is routine (`pnpm check:surface`) and must not break
// tests that are about how the baseline is *reported*, not what it is.
const S2_VERIFIED = s2Manifest.surface?.verified?.version;

let dir: string;

beforeEach(() => {
  clearInstalledVersionCache();
  dir = mkdtempSync(join(tmpdir(), 'api-doctor-versions-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  clearInstalledVersionCache();
});

function writePkg(deps: Record<string, string>): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }), 'utf-8');
}

function detected(name: string, source: DetectedProvider['source'] = 'package.json'): DetectedProvider[] {
  return [{ name, source, checked: true }];
}

describe('resolveProviderVersions', () => {
  it('reports the installed version alongside the verified baseline', () => {
    // A real semver baseline must exist, or the assertions below are vacuous.
    expect(S2_VERIFIED).toMatch(/^\d+\.\d+\.\d+$/);
    writePkg({ '@s2-dev/streamstore': '0.23.0' });

    const version = resolveProviderVersions(detected('s2'), dir).get('s2');

    expect(version?.packageName).toBe('@s2-dev/streamstore');
    expect(version?.installed).toBe('0.23.0');
    expect(version?.verified).toBe(S2_VERIFIED);
    expect(version?.differs).toBe(true);
  });

  it('does not flag a difference when the installed version matches the baseline', () => {
    writePkg({ '@s2-dev/streamstore': S2_VERIFIED as string });

    expect(resolveProviderVersions(detected('s2'), dir).get('s2')?.differs).toBe(false);
  });

  it('omits a provider whose version cannot be resolved rather than guessing', () => {
    writePkg({ '@s2-dev/streamstore': 'latest' });

    // "unknown" must not render the same as a real version.
    expect(resolveProviderVersions(detected('s2'), dir).has('s2')).toBe(false);
  });

  it('omits a provider that is absent from package.json entirely', () => {
    writePkg({ 'some-other-pkg': '1.0.0' });

    expect(resolveProviderVersions(detected('s2'), dir).has('s2')).toBe(false);
  });

  it.skipIf(!unverified)('resolves a provider that has no verified baseline yet', () => {
    const packageName = unverified!.surface!.packages[0]!;
    writePkg({ [packageName]: '1.2.3' });

    const version = resolveProviderVersions(detected(unverified!.name), dir).get(unverified!.name);

    expect(version?.installed).toBe('1.2.3');
    expect(version?.verified).toBeUndefined();
    // Nothing to compare against, so nothing to report as differing.
    expect(version?.differs).toBe(false);
  });

  it('resolves through node_modules when the declared spec is a range', () => {
    writePkg({ '@s2-dev/streamstore': '^0.24.0' });
    const modDir = join(dir, 'node_modules', '@s2-dev', 'streamstore');
    mkdirSync(modDir, { recursive: true });
    writeFileSync(join(modDir, 'package.json'), JSON.stringify({ version: '0.24.7' }), 'utf-8');

    expect(resolveProviderVersions(detected('s2'), dir).get('s2')?.installed).toBe('0.24.7');
  });

  it('ignores an unknown provider name', () => {
    writePkg({ resend: '6.1.0' });

    expect(resolveProviderVersions(detected('not-a-provider'), dir).size).toBe(0);
  });

  it('resolves each detected provider independently', () => {
    writePkg({ '@s2-dev/streamstore': '0.25.0', resend: '6.1.0' });

    const versions = resolveProviderVersions(
      [...detected('s2'), { name: 'resend', source: 'package.json', checked: true }],
      dir,
    );

    expect(versions.get('s2')?.installed).toBe('0.25.0');
    expect(versions.get('resend')?.installed).toBe('6.1.0');
  });
});
