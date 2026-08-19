/**
 * Per-provider SDK versions for the scan report: what the project has
 * installed, and what the provider's checks were last verified against.
 *
 * Without this the dev is told their integration is (or is not) correct with no
 * way to see which SDK version that verdict was formed against. Showing both
 * numbers is deliberately all this does — it reports the two facts and leaves
 * the judgement to the reader. It never recommends an upgrade, matching the
 * compatibility rules, which fire only on a mismatch with the installed
 * version and never on being behind.
 */
import { join } from 'node:path';
import { compareSemver, resolveInstalledVersion } from './plugin/installed-version.js';
import { providers } from './providers/index.js';
import type { DetectedProvider } from './types.js';

export interface ProviderVersion {
  /** Package the version was resolved from. */
  packageName: string;
  /** Version installed in the scanned project. */
  installed: string;
  /** Version the provider's surface/checks were hand-verified against. */
  verified?: string;
  /** Installed and verified are both known and differ. */
  differs: boolean;
}

/**
 * Resolves the installed version for each detected provider.
 *
 * Providers whose version cannot be resolved are absent from the map rather
 * than present with a null — "unknown" and "not applicable" must not render
 * the same, and a guessed version is worse than none.
 */
export function resolveProviderVersions(
  detected: DetectedProvider[],
  projectDir: string,
): Map<string, ProviderVersion> {
  const out = new Map<string, ProviderVersion>();
  // resolveInstalledVersion walks up from a file, so anchor it at the
  // project's own manifest rather than a source file that may sit in a
  // workspace member with its own package.json.
  const anchor = join(projectDir, 'package.json');

  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    if (!manifest) continue;

    // Surface packages are the client-bearing ones; detect.packages is the
    // wider net (helper packages that never construct a client).
    const candidates = manifest.surface?.packages ?? manifest.detect.packages ?? [];
    for (const packageName of candidates) {
      const installed = resolveInstalledVersion(anchor, packageName);
      if (!installed) continue;
      const verified = manifest.surface?.verified?.version;
      out.set(d.name, {
        packageName,
        installed,
        verified,
        differs: verified !== undefined && compareSemver(installed, verified) !== 0,
      });
      break;
    }
  }
  return out;
}
