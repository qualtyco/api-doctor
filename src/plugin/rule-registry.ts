/**
 * Lookup of per-rule documentation metadata (category, rationale, CWE/OWASP),
 * keyed by the plugin rule key. The manifest owns user-facing message/fix/
 * severity; this registry owns the longer-form docs surfaced in reports.
 */
import type { FindingCategory } from '../types.js';
import { plugin } from './index.js';

export interface RuleDocsMeta {
  category: FindingCategory;
  description: string;
  rationale: string;
  docsUrl?: string;
  cwe?: string;
  owasp?: string;
}

function buildRegistry(): Map<string, RuleDocsMeta> {
  const registry = new Map<string, RuleDocsMeta>();
  for (const [key, rule] of Object.entries(plugin.rules)) {
    const docs = (rule as any)?.meta?.docs ?? {};
    registry.set(key, {
      category: docs.category,
      description: docs.description ?? '',
      rationale: docs.rationale ?? '',
      docsUrl: docs.docsUrl,
      cwe: docs.cwe,
      owasp: docs.owasp,
    });
  }
  return registry;
}

const registry = buildRegistry();

export function getRuleDocsMeta(ruleKey: string): RuleDocsMeta | undefined {
  return registry.get(ruleKey);
}
