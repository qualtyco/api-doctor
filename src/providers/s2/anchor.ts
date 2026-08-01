/**
 * S2 anchor: evidence tying a file or call receiver to S2 (streamstore).
 * Mirrors the evidence rules of createS2FileTracker in ./utils.ts, which S2
 * rules additionally apply internally.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { s2Manifest } from './manifest.js';

export const s2Anchor: ProviderAnchor = {
  provider: 's2',
  packages: [
    ...new Set([...(s2Manifest.detect.packages ?? []), ...(s2Manifest.detect.imports ?? [])]),
    '@s2-dev/',
  ],
  clientConstructors: ['S2'],
  clientNamePattern: /^s2(client)?$/i,
  wrapperSourcePattern: /(^|\/)s2([-_.]?client)?(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(s2Manifest.detect.urlPatterns ?? [])],
  tokenPattern: /S2_ACCESS_TOKEN|aws\.s2\.dev/i,
};
