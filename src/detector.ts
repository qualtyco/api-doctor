/**
 * Detects which API providers are present using package manifests, imports,
 * and URL substrings — for both JavaScript/TypeScript and Python sources.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isJavascriptFile, isPythonFile } from './engines/classify.js';
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

function hasPythonImportPattern(source: string, pkg: string): boolean {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    String.raw`(^|\n)\s*(import\s+${escaped}(\s|\.|$)|from\s+${escaped}(\s|\.|$))`,
    'm',
  );
  return re.test(source);
}

function requirementName(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) return null;
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)/);
  return match ? match[1].toLowerCase().replace(/_/g, '-') : null;
}

async function loadPythonPackages(directory: string): Promise<{
  packages: Set<string>;
  source: 'pyproject' | 'requirements' | null;
}> {
  const packages = new Set<string>();
  let source: 'pyproject' | 'requirements' | null = null;

  try {
    const raw = await readFile(join(directory, 'pyproject.toml'), 'utf-8');
    const depBlock = raw.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depBlock) {
      for (const m of depBlock[1].matchAll(/["']([A-Za-z0-9_.-]+)/g)) {
        packages.add(m[1].toLowerCase().replace(/_/g, '-'));
        source = 'pyproject';
      }
    }
    const poetry = raw.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|\s*$)/);
    if (poetry) {
      for (const line of poetry[1].split('\n')) {
        const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/);
        if (m && m[1].toLowerCase() !== 'python') {
          packages.add(m[1].toLowerCase().replace(/_/g, '-'));
          source = 'pyproject';
        }
      }
    }
  } catch {
    // no pyproject
  }

  try {
    const entries = await readdir(directory);
    for (const name of entries) {
      if (!/^requirements.*\.txt$/i.test(name)) continue;
      try {
        const raw = await readFile(join(directory, name), 'utf-8');
        for (const line of raw.split(/\r?\n/)) {
          const pkg = requirementName(line);
          if (pkg) {
            packages.add(pkg);
            if (!source) source = 'requirements';
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  return { packages, source };
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
  const pyEntries = [...filesContent.entries()].filter(([path]) => isPythonFile(path));
  const jsSources = jsEntries.map(([, src]) => src);
  const pySources = pyEntries.map(([, src]) => src);
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

  const { packages: pyPackages, source: pyPkgSource } = await loadPythonPackages(directory);

  for (const provider of providers) {
    if (detected.has(provider.name)) continue;

    const jsImports = provider.detect.imports ?? [];
    const pyImports = provider.detect.pythonImports ?? [];
    const urls = provider.detect.urlPatterns ?? [];

    const matchedFiles = [...filesContent.entries()]
      .filter(([path, source]) => {
        if (isJavascriptFile(path)) {
          return (
            jsImports.some((p) => hasJsImportPattern(source, p)) ||
            urls.some((u) => source.includes(u))
          );
        }
        if (isPythonFile(path)) {
          return (
            pyImports.some((p) => hasPythonImportPattern(source, p)) ||
            urls.some((u) => source.includes(u))
          );
        }
        return false;
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

    const pythonPackages = (provider.detect.pythonPackages ?? []).map((p) =>
      p.toLowerCase().replace(/_/g, '-'),
    );
    if (pythonPackages.some((p) => pyPackages.has(p))) {
      mark(pyPkgSource === 'requirements' ? 'requirements' : 'pyproject');
      continue;
    }

    if (jsImports.some((p) => jsSources.some((s) => hasJsImportPattern(s, p)))) {
      mark('imports');
      continue;
    }

    if (pyImports.some((p) => pySources.some((s) => hasPythonImportPattern(s, p)))) {
      mark('python-imports');
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
  const hasPy = pyEntries.length > 0;
  for (const d of detected.values()) {
    const manifest = providers.find((p) => p.name === d.name);
    if (!manifest) {
      d.checked = false;
      continue;
    }
    d.checked = manifest.rules.some((rule) => {
      const langs = ruleLanguages(rule);
      return (hasJs && langs.includes('javascript')) || (hasPy && langs.includes('python'));
    });
  }

  return { detected: [...detected.values()], rawPackages: Object.keys(deps) };
}
