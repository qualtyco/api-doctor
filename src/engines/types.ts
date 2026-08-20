/**
 * Shared types for language-specific scan engines.
 */
import type { MigrationTarget, RuleMeta, ScanResult } from '../types.js';

export interface EngineInput {
  absRoot: string;
  files: string[];
  filesContent: Map<string, string>;
  detectedNames: Set<string>;
  ruleMetaByKey: Map<string, RuleMeta>;
  /**
   * Verified client bindings per provider, keyed by file:
   * `{ supabase: { 'src/db.ts': { yes: ['db'], no: [] } } }`.
   *
   * Resolved in the CLI process, where cross-module resolution is available.
   * Handed to the lint plugin as an additive evidence source: `yes` can only
   * confirm a binding is a client, `no` only records a binding proven to be
   * something else. An incomplete map degrades to the plugin's own
   * single-file behaviour rather than silencing rules.
   */
  clientBindings?: Record<string, Record<string, { yes: string[]; no: string[] }>>;
  /**
   * Set only by a `--migrate` run. Forwarded to the plugin, where it reverses
   * the version gate on that one provider's compatibility rules. Absent means
   * every rule keeps its ordinary backward-looking behaviour, which is what a
   * plain scan must always do.
   */
  migrate?: MigrationTarget;
}

export type { ScanResult };
