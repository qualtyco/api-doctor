/**
 * OpenAI Realtime anchor: evidence tying a file to the Realtime API. There is
 * no required JS package — realtime code often speaks raw WebSocket/WebRTC to
 * the API — so URL and token evidence carry most of the weight.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { openaiRealtimeManifest } from './manifest.js';

export const openaiRealtimeAnchor: ProviderAnchor = {
  provider: 'openai-realtime',
  packages: ['@openai/agents-realtime', '@openai/realtime-api-beta'],
  clientConstructors: ['OpenAIRealtimeWS', 'OpenAIRealtimeWebRTC', 'RealtimeClient'],
  urlSubstrings: [...(openaiRealtimeManifest.detect.urlPatterns ?? [])],
  tokenPattern: /realtime=v1|gpt-4o(-mini)?-realtime|gpt-realtime|\/v1\/realtime/i,
};
