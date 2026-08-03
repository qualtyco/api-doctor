/**
 * Cross-file client identities, supplied by the CLI process.
 *
 * The plugin-side tracker (client-tracker.ts) deliberately never leaves the
 * file it is linting, so it cannot know that `db` in `src/repos.ts` came from
 * a `createClient()` in `src/db.ts`. The CLI can: `coverage/collect.ts` already
 * resolves that, verifying identity rather than guessing from names.
 *
 * The runner writes those bindings to a temp file and points
 * `API_DOCTOR_CLIENT_MODULES` at it. This module reads it once per plugin
 * process.
 *
 * Contract: ADDITIVE ONLY. Entries here confirm a binding is a client; nothing
 * here can mark a binding as *not* a client. A missing, unreadable or
 * incomplete map therefore degrades exactly to the tracker's own behaviour —
 * it can never cause a rule to go quiet.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/** provider -> absolute file path -> verified client binding names */
type Entry = { yes: Set<string>; no: Set<string> };
type Loaded = Map<string, Map<string, Entry>>;

let loaded = false;
let byProvider: Loaded = new Map();

/**
 * Resolve symlinks so map keys match the filenames oxlint reports. On macOS
 * `/tmp` is a symlink to `/private/tmp`; without this every lookup misses and
 * the map silently contributes nothing.
 */
const realCache = new Map<string, string>();
function real(p: string): string {
  const hit = realCache.get(p);
  if (hit !== undefined) return hit;
  let out = p;
  try {
    out = realpathSync(p);
  } catch {
    /* file may not exist — use as given */
  }
  realCache.set(p, out);
  return out;
}

function load(): void {
  if (loaded) return;
  loaded = true;

  const path = process.env.API_DOCTOR_CLIENT_MODULES;
  if (!path) return;

  let raw: Record<string, Record<string, { yes: string[]; no: string[] }>>;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return; // unreadable → contribute nothing
  }

  // Paths arrive relative to the scan root; oxlint reports absolute paths.
  const root = process.cwd();

  for (const [provider, files] of Object.entries(raw)) {
    const perFile = new Map<string, Entry>();
    for (const [relPath, e] of Object.entries(files)) {
      const abs = real(isAbsolute(relPath) ? relPath : resolve(root, relPath));
      perFile.set(abs, { yes: new Set(e.yes ?? []), no: new Set(e.no ?? []) });
    }
    byProvider.set(provider, perFile);
  }
}

/** Verified client binding names for `filename` under `provider`, if any. */
export function clientBindingsFor(provider: string, filename: string): Set<string> | undefined {
  load();
  return byProvider.get(provider)?.get(real(filename))?.yes;
}

/**
 * Bindings the CLI positively traced to a non-provider origin — another
 * vendor's package, or a project module exporting no client.
 *
 * This is the one place the map may *deny*, and it is deliberately narrow: a
 * binding appears here only when its origin was resolved and found to be
 * something else. Anything unresolved is simply absent.
 */
export function nonClientBindingsFor(provider: string, filename: string): Set<string> | undefined {
  load();
  return byProvider.get(provider)?.get(real(filename))?.no;
}

/** True when the CLI verified at least one client binding in this file. */
export function fileHasVerifiedClient(provider: string, filename: string): boolean {
  const names = clientBindingsFor(provider, filename);
  return names !== undefined && names.size > 0;
}
