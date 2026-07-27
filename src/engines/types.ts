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
}

export type { ScanResult };
