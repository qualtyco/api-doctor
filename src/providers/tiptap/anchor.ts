/**
 * Tiptap anchor: evidence tying a file or call receiver to Tiptap.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { tiptapManifest } from './manifest.js';

export const tiptapAnchor: ProviderAnchor = {
  provider: 'tiptap',
  packages: [
    ...new Set([...(tiptapManifest.detect.packages ?? []), ...(tiptapManifest.detect.imports ?? [])]),
    '@tiptap/',
  ],
  clientConstructors: ['Editor'],
  clientNamePattern: /tiptap/i,
  urlSubstrings: [...(tiptapManifest.detect.urlPatterns ?? [])],
  tokenPattern: /tiptap/i,
};
