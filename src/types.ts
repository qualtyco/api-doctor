/**
 * Shared contracts for provider detection, oxlint rule mapping, and scan output.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface ScanResult {
  file: string;
  line: number;
  snippet: string;
  rule: string;
  severity: Severity;
  message: string;
  fix: string;
  docsUrl?: string;
}

/** Maps a provider to the oxlint rules that should run when it is detected. */
export interface OxlintRuleMeta {
  /** Rule key registered in the plugin (e.g. `resend-webhook-signature`). */
  key: string;
  /** Human-readable rule id shown in reports (e.g. `resend/webhook-signature-missing`). */
  resultRule: string;
  message: string;
  fix: string;
  docsUrl?: string;
  severity?: Severity;
}

export interface ProviderManifest {
  name: string;
  displayName: string;
  detect: {
    packages?: string[];
    imports?: string[];
    urlPatterns?: string[];
  };
  oxlintRules: OxlintRuleMeta[];
}

export interface DetectedProvider {
  name: string;
  source: 'package.json' | 'imports' | 'url-patterns';
  /** True when api-doctor ran oxlint rules for this provider. */
  checked: boolean;
}
