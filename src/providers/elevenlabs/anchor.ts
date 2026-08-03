/**
 * ElevenLabs anchor: evidence tying a file or call receiver to ElevenLabs.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { elevenlabsManifest } from './manifest.js';

export const elevenlabsAnchor: ProviderAnchor = {
  provider: 'elevenlabs',
  packages: [
    ...new Set([
      ...(elevenlabsManifest.detect.packages ?? []),
      ...(elevenlabsManifest.detect.imports ?? []),
    ]),
    '@elevenlabs/',
    '@11labs/',
  ],
  // `Conversation` (@elevenlabs/client) is a real export used via static
  // `Conversation.startSession()` — kept as import evidence. The `ElevenLabs`
  // name is only a types namespace in both SDK packages, so it is omitted.
  clientConstructors: ['ElevenLabsClient', 'Conversation'],
  clientNamePattern: /(elevenlabs|eleven[-_]?labs|11labs)/i,
  wrapperSourcePattern: /(^|\/)(elevenlabs|eleven[-_]?labs)(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(elevenlabsManifest.detect.urlPatterns ?? []), 'elevenlabs.io'],
  tokenPattern: /ELEVENLABS_|ELEVEN_LABS_|xi-api-key/i,
};
