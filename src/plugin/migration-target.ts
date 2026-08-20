/**
 * The requested migration target, supplied by the CLI process.
 *
 * Same channel shape as client-modules.ts and for the same reason: the plugin
 * runs inside a spawned oxlint, so anything the CLI decided has to arrive
 * through the environment. This payload is two short strings, so it travels
 * inline in `API_DOCTOR_MIGRATE` rather than via a temp file.
 *
 * Contract: absent means BACKWARD. With no target every compatibility rule
 * keeps its original gate — fire only when the installed version is already
 * past `removedIn` — which is what a plain `api-doctor .` must always do. A
 * malformed or unreadable value degrades to exactly that, so a broken env var
 * can never turn a scan into an upgrade recommendation.
 *
 * The target names ONE provider. Rules for every other provider read
 * `migrationTargetFor` as undefined and behave normally, so a migration run
 * cannot silently change what the rest of the scan means.
 */
import type { MigrationTarget } from '../types.js';

let loaded = false;
let target: MigrationTarget | undefined;

function load(): void {
  if (loaded) return;
  loaded = true;

  const raw = process.env.API_DOCTOR_MIGRATE;
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Partial<MigrationTarget>;
    // Every field must be a non-empty string. A half-formed target is treated
    // as no target: reading `{provider: 'supabase'}` with no version would make
    // the direction of every gate undefined.
    if (
      typeof parsed?.provider === 'string' &&
      parsed.provider.length > 0 &&
      typeof parsed.target === 'string' &&
      parsed.target.length > 0
    ) {
      target = {
        provider: parsed.provider,
        target: parsed.target,
        // The plugin compares versions and never renders one, so a payload
        // without a label still works; it falls back rather than being
        // rejected, which keeps a partial payload from silencing the rule.
        label: typeof parsed.label === 'string' ? parsed.label : parsed.target,
        raw: typeof parsed.raw === 'string' ? parsed.raw : parsed.target,
      };
    }
  } catch {
    /* unparseable → no target, i.e. ordinary backward-looking behaviour */
  }
}

/**
 * The migration target if this run is migrating `provider`, otherwise
 * undefined. Callers branch on the presence of a value, never on its absence
 * meaning "latest".
 */
export function migrationTargetFor(provider: string): MigrationTarget | undefined {
  load();
  return target?.provider === provider ? target : undefined;
}

/** Test seam: forget the cached read so a new environment takes effect. */
export function resetMigrationTargetCache(): void {
  loaded = false;
  target = undefined;
}
