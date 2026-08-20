/**
 * Detects which API providers are present using package manifests, imports,
 * and URL substrings.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isJavascriptFile } from './engines/classify.js';
import { providers } from './providers/index.js';
import { ruleLanguages, type DetectedProvider, type DetectionSource } from './types.js';

function hasJsImportPattern(source: string, pkg: string): boolean {
  return (
    source.includes(`from '${pkg}'`) ||
    source.includes(`from "${pkg}"`) ||
    source.includes(`require('${pkg}')`) ||
    source.includes(`require("${pkg}")`)
  );
}

export interface DetectResult {
  detected: DetectedProvider[];
  rawPackages: string[];
}

export async function detectProviders(
  directory: string,
  filesContent: Map<string, string>,
): Promise<DetectResult> {
  const detected = new Map<string, DetectedProvider>();

  const jsEntries = [...filesContent.entries()].filter(([path]) => isJavascriptFile(path));
  const jsSources = jsEntries.map(([, src]) => src);
  const allSources = [...filesContent.values()].join('\n');

  let deps: Record<string, string> = {};
  try {
    const raw = await readFile(join(directory, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    // missing package.json
  }

  for (const provider of providers) {
    if (detected.has(provider.name)) continue;

    const jsImports = provider.detect.imports ?? [];
    const urls = provider.detect.urlPatterns ?? [];

    const matchedFiles = [...filesContent.entries()]
      .filter(([path, source]) => {
        if (!isJavascriptFile(path)) return false;
        return (
          jsImports.some((p) => hasJsImportPattern(source, p)) ||
          urls.some((u) => source.includes(u))
        );
      })
      .map(([file]) => file);

    const mark = (source: DetectionSource) => {
      detected.set(provider.name, {
        name: provider.name,
        source,
        checked: provider.rules.length > 0,
        files: matchedFiles,
      });
    };

    const packages = provider.detect.packages ?? [];
    if (packages.some((p) => p in deps)) {
      mark('package.json');
      continue;
    }

    if (jsImports.some((p) => jsSources.some((s) => hasJsImportPattern(s, p)))) {
      mark('imports');
      continue;
    }

    const matchedUrl = urls.find((u) => {
      if (!allSources.includes(u)) return false;
      const isShadowed = providers.some((other) => {
        if (other === provider) return false;
        return (other.detect.urlPatterns ?? []).some(
          (otherUrl) => otherUrl !== u && otherUrl.includes(u) && allSources.includes(otherUrl),
        );
      });
      return !isShadowed;
    });
    if (matchedUrl) mark('url-patterns');
  }

  const hasJs = jsEntries.length > 0;
  for (const d of detected.values()) {
    const manifest = providers.find((p) => p.name === d.name);
    if (!manifest) {
      d.checked = false;
      continue;
    }
    d.checked = manifest.rules.some((rule) => hasJs && ruleLanguages(rule).includes('javascript'));
  }

  return { detected: [...detected.values()], rawPackages: Object.keys(deps) };
}
