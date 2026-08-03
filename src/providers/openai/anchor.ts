/**
 * OpenAI computer-use anchor: evidence tying a file or call receiver to the
 * OpenAI SDK. Covers general Responses API rules and computer-use rules —
 * the CUA-specific rules add their own computer-use evidence checks on top.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { openaiManifest } from './manifest.js';

export const openaiAnchor: ProviderAnchor = {
  provider: 'openai',
  packages: [
    ...new Set([...(openaiManifest.detect.packages ?? []), ...(openaiManifest.detect.imports ?? [])]),
  ],
  clientConstructors: ['OpenAI', 'AzureOpenAI'],
  clientNamePattern: /^openai([-_]?client)?$/i,
  wrapperSourcePattern: /(^|\/)openai(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(openaiManifest.detect.urlPatterns ?? [])],
  tokenPattern: /OPENAI_API_KEY|computer[-_]?use[-_]?preview|computer[-_]?call/i,
};
