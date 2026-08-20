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
import { dirname, join } from 'node:path';
import { highestRemovedIn } from './migration.js';
import { compareSemver, resolveInstalledVersion } from './plugin/installed-version.js';
import { providers } from './providers/index.js';
import type { DetectedProvider } from './types.js';

export interface ProviderVersion {
  /** Package the version was resolved from. */
  packageName: string;
  /**
   * The version the scan reports for this provider: the LOWEST distinct version
   * resolved across the files that reference it.
   *
   * Lowest, not first-found, because every consumer is asking a
   * furthest-behind question — is anything here below a removal, is there a
   * migration left to run, is a plan finished. In a workspace where one app is
   * on 1.35.7 and another on 2.112.3, the answer to all three is governed by
   * 1.35.7.
   */
  installed: string;
  /**
   * Every distinct version resolved, ascending. Longer than one only in a
   * workspace that installs the same SDK at different versions, which is
   * common in real monorepos and must not be flattened away silently — a
   * report claiming a single version there is stating something false.
   */
  versions: string[];
  /** Version the provider's surface/checks were hand-verified against. */
  verified?: string;
  /** Installed and verified are both known and differ. */
  differs: boolean;
  /**
   * Target of a migration this project could be mapped for: the highest version
   * at which this provider removes something the installed version still has.
   *
   * Its presence means only that `--migrate` has something to say here — never
   * that the project should upgrade. The line it drives states a capability of
   * the tool, and the distinction is the whole reason this is a separate field
   * from `differs`: being behind the verified baseline is normal and carries no
   * suggestion, while "there is a plan available for this" is a fact about
   * api-doctor, not advice about the dependency.
   */
  migrationTarget?: string;
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

  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    if (!manifest) continue;

    const anchors = anchorsFor(d, projectDir);

    // Order matters, and the compatibility package comes first.
    //
    // Every version-gated decision — does a removal apply, is there a migration
    // left, is a plan finished — is about ONE package: the one the removals
    // were verified against. The other candidates are only ever a display
    // fallback. Taking whichever resolved first produced a genuinely false
    // report on a real project: a Vue Tiptap app has no `@tiptap/react` at all,
    // so the lookup fell through to `@tiptap/core@2.27.2` and the migration
    // plan printed that number under the heading `@tiptap/react` — a version
    // attributed to a package it was never read from.
    //
    // Surface packages are the client-bearing ones; detect.packages is the
    // wider net (helper packages that never construct a client).
    const compatPackage = manifest.compatibility?.package;
    const candidates = [
      ...(compatPackage ? [compatPackage] : []),
      ...(manifest.surface?.packages ?? manifest.detect.packages ?? []),
    ].filter((name, i, all) => all.indexOf(name) === i);
    for (const packageName of candidates) {
      const found = new Set<string>();
      for (const anchor of anchors) {
        const v = resolveInstalledVersion(anchor, packageName);
        if (v) found.add(v);
      }
      if (found.size === 0) continue;

      const versions = [...found].sort((a, b) => compareSemver(a, b) ?? a.localeCompare(b));
      const installed = versions[0];
      const verified = manifest.surface?.verified?.version;

      // Offered only when the installed version is genuinely below a removal
      // this provider has data for. A project already past every removal has
      // nothing to plan, and saying otherwise would turn an informational line
      // into a nag.
      //
      // Only when the version came from the compatibility package itself. A
      // number read off a sibling package says nothing about whether this
      // provider's removals apply, and offering a plan on that basis points
      // the user at work that may not exist.
      const ceiling =
        manifest.compatibility && packageName === compatPackage
          ? highestRemovedIn(manifest)
          : undefined;
      const behind = ceiling !== undefined && (compareSemver(installed, ceiling) ?? 0) < 0;

      out.set(d.name, {
        packageName,
        installed,
        versions,
        verified,
        differs: verified !== undefined && compareSemver(installed, verified) !== 0,
        ...(behind ? { migrationTarget: ceiling } : {}),
      });
      break;
    }
  }
  return out;
}

/**
 * Where to ask "which version is installed here", for one detected provider.
 *
 * The files that actually reference the SDK come first, because that is the
 * question the compatibility rules answer — `resolveInstalledVersion` walks up
 * from a source file, so a file in `apps/web` finds `apps/web/package.json`.
 *
 * Anchoring at the scanned root alone, as this used to, is right for a
 * single-package project and wrong for every monorepo. A root `package.json`
 * listing only `workspaces` declares none of its members' dependencies, so the
 * lookup found nothing and the provider was reported with no version at all —
 * while the rules, resolving per file, were gating findings correctly the whole
 * time. Two different answers to one question, and the weaker one was the one
 * users saw. On a sample of twenty real projects it left six of them
 * version-less, and made `--migrate` refuse to run on repos whose findings
 * would have been correct.
 *
 * The root is still consulted, last: a provider detected from `package.json`
 * alone has no files to anchor on.
 *
 * Deduplicated by directory — `resolveInstalledVersion` caches per directory,
 * so a thousand files in one package cost a single walk.
 */
function anchorsFor(detectedProvider: DetectedProvider, projectDir: string): string[] {
  const dirs = new Set<string>();
  const anchors: string[] = [];
  for (const rel of detectedProvider.files ?? []) {
    const abs = join(projectDir, rel);
    const dir = dirname(abs);
    if (dirs.has(dir)) continue;
    dirs.add(dir);
    anchors.push(abs);
  }
  anchors.push(join(projectDir, 'package.json'));
  return anchors;
}
