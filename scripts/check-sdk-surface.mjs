#!/usr/bin/env node
/**
 * Guards hand-written surface manifests against SDK drift.
 *
 * Coverage's `surface.methods` lists are hand-verified snapshots of a
 * provider's SDK. When the SDK adds, renames, or removes methods, calls to
 * them silently drop out of coverage — undercounting that looks identical to
 * "unused" in the telemetry. This script downloads the provider's latest npm
 * package, derives the real method surface from its published type
 * declarations, and diffs it against the manifest.
 *
 * Usage: node scripts/check-sdk-surface.mjs
 * Exits 1 on drift. Network-dependent by design — run it before releases or
 * on a schedule (alongside check:links), not inside the unit-test suite.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

/**
 * One entry per provider with a surface manifest.
 *   pkg        npm package whose types define the surface
 *   rootClass  client class whose readonly resource properties are walked
 *   dts        candidate type-declaration paths inside the package
 *   manifest   manifest file holding surface.methods
 */
const TARGETS = [
  {
    provider: 'resend',
    pkg: 'resend',
    rootClass: 'Resend',
    dts: ['dist/index.d.mts', 'dist/index.d.ts', 'dist/index.d.cts'],
    manifest: 'src/providers/resend/manifest.ts',
  },
];

/** Parses `declare class X { ... }` blocks: methods + readonly resource props. */
function parseClasses(dtsText) {
  const classes = new Map();
  let current = null;
  for (const line of dtsText.split('\n')) {
    const decl = line.match(/^declare class ([\w$]+)/);
    if (decl) {
      current = { methods: new Set(), props: new Map() };
      classes.set(decl[1], current);
      continue;
    }
    if (!current) continue;
    if (/^\}/.test(line)) {
      current = null;
      continue;
    }
    const prop = line.match(/^\s*readonly ([\w$]+): ([\w$]+);/);
    if (prop) {
      current.props.set(prop[1], prop[2]);
      continue;
    }
    const method = line.match(/^\s{2}([\w$]+)\s*[<(]/);
    if (method && method[1] !== 'constructor') current.methods.add(method[1]);
  }
  return classes;
}

/**
 * Walks resource properties from the root client class and returns the full
 * set of dotted method paths. The root class's own methods (low-level
 * post/get/fetchRequest transport) are excluded — only resources count.
 */
function deriveSurface(classes, rootName) {
  const out = new Set();
  const root = classes.get(rootName);
  if (!root) throw new Error(`root class ${rootName} not found in type declarations`);
  const visit = (cls, prefix, depth) => {
    if (depth > 5) return;
    for (const m of cls.methods) out.add(`${prefix}.${m}`);
    for (const [prop, clsName] of cls.props) {
      const child = classes.get(clsName);
      if (child) visit(child, `${prefix}.${prop}`, depth + 1);
    }
  };
  for (const [prop, clsName] of root.props) {
    const child = classes.get(clsName);
    if (child) visit(child, prop, 1);
  }
  return out;
}

/** Extracts surface.methods entries from a manifest file's source text. */
function manifestMethods(manifestPath) {
  const text = readFileSync(manifestPath, 'utf8');
  const block = text.match(/surface:\s*\{[\s\S]*?methods:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error(`no surface.methods block found in ${manifestPath}`);
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

let failed = false;

for (const target of TARGETS) {
  const tmp = mkdtempSync(join(tmpdir(), 'api-doctor-surface-'));
  try {
    execSync(`npm pack ${target.pkg}@latest --pack-destination "${tmp}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'));
    if (!tarball) throw new Error(`npm pack produced no tarball for ${target.pkg}`);
    execSync(`tar xzf "${tarball}"`, { cwd: tmp });
    const pkgDir = join(tmp, 'package');
    const version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;

    let dtsText = null;
    for (const candidate of target.dts) {
      try {
        dtsText = readFileSync(join(pkgDir, candidate), 'utf8');
        break;
      } catch {
        // try next candidate
      }
    }
    if (dtsText === null) {
      console.error(`FAIL ${target.provider}: none of ${target.dts.join(', ')} found in ${target.pkg}@${version}`);
      failed = true;
      continue;
    }

    const derived = deriveSurface(parseClasses(dtsText), target.rootClass);
    const listed = manifestMethods(join(ROOT, target.manifest));

    const missing = [...derived].filter((m) => !listed.has(m)).sort();
    const stale = [...listed].filter((m) => !derived.has(m)).sort();

    if (missing.length === 0 && stale.length === 0) {
      console.log(`${target.provider}: surface matches ${target.pkg}@${version} (${listed.size} methods)`);
      continue;
    }
    failed = true;
    console.error(`FAIL ${target.provider}: surface drift against ${target.pkg}@${version}`);
    for (const m of missing) console.error(`  missing from manifest: ${m}`);
    for (const m of stale) console.error(`  stale in manifest (not in SDK): ${m}`);
    console.error(`  update ${target.manifest} and re-verify against the SDK docs`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

process.exit(failed ? 1 : 0);
