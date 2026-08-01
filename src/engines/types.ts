/**
 * Shared types for language-specific scan engines.
 */
import type { RuleMeta, ScanResult } from '../types.js';

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
}

export type { ScanResult };
