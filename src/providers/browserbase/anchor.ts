/**
 * Browserbase anchor: evidence tying a file or call receiver to Browserbase.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { browserbaseManifest } from './manifest.js';

export const browserbaseAnchor: ProviderAnchor = {
  provider: 'browserbase',
  packages: [
    ...new Set([
      ...(browserbaseManifest.detect.packages ?? []),
      ...(browserbaseManifest.detect.imports ?? []),
    ]),
    '@browserbasehq/',
  ],
  clientConstructors: ['Browserbase', 'Stagehand'],
  clientNamePattern: /^(bb|browserbase\w*)$/i,
  wrapperSourcePattern: /(^|\/)browserbase(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(browserbaseManifest.detect.urlPatterns ?? [])],
  tokenPattern: /BROWSERBASE_/,
};
