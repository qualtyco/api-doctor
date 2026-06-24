/**
 * Detects which API providers are present in a project using package.json
 * dependencies, import patterns in source files, and URL substrings.
 * This is the only non-oxlint step — it decides which rules to enable.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DetectedProvider } from './types.js';
import { providers } from './providers/index.js';

function hasImportPattern(source: string, pkg: string): boolean {
  return (
    source.includes(`from '${pkg}'`) ||
    source.includes(`from "${pkg}"`) ||
    source.includes(`require('${pkg}')`) ||
    source.includes(`require("${pkg}")`)
  );
}

export interface DetectResult {
  detected: DetectedProvider[];
  /** All package names from package.json (deps + devDeps). Empty if no package.json. */
  rawPackages: string[];
}

export async function detectProviders(
  directory: string,
  filesContent: Map<string, string>,
): Promise<DetectResult> {
  // Dedupe by provider name — each SDK is only reported once.
  const detected = new Map<string, DetectedProvider>();

  // Single string of all source files, used for URL pattern matching below.
  const allSources = [...filesContent.values()].join('\n');

  // Load dependencies from package.json (if it exists).
  let deps: Record<string, string> = {};
  try {
    const raw = await readFile(join(directory, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    // missing or invalid package.json — skip package-based detection
  }

  // Check each registered provider (Resend, Stripe, Supabase, …).
  for (const provider of providers) {
    if (detected.has(provider.name)) continue;

    // Stage 1: match npm package names in dependencies / devDependencies.
    const packages = provider.detect.packages ?? [];
    if (packages.some((p) => p in deps)) {
      detected.set(provider.name, {
        name: provider.name,
        source: 'package.json',
        checked: provider.oxlintRules.length > 0,
      });
      continue;
    }

    // Stage 2: match import/require statements in source files.
    const imports = provider.detect.imports ?? [];
    if (imports.some((p) => [...filesContent.values()].some((s) => hasImportPattern(s, p)))) {
      detected.set(provider.name, {
        name: provider.name,
        source: 'imports',
        checked: provider.oxlintRules.length > 0,
      });
      continue;
    }

    // Stage 3: match API URL substrings anywhere in source (e.g. api.resend.com).
    const urls = provider.detect.urlPatterns ?? [];
    if (urls.some((u) => allSources.includes(u))) {
      detected.set(provider.name, {
        name: provider.name,
        source: 'url-patterns',
        checked: provider.oxlintRules.length > 0,
      });
    }
  }

  return { detected: [...detected.values()], rawPackages: Object.keys(deps) };
}
