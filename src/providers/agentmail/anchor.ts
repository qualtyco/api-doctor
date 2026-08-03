/**
 * AgentMail anchor: evidence tying a file or call receiver to AgentMail.
 * Mirrors the evidence rules of createAgentMailFileTracker in ./utils.ts,
 * which AgentMail rules additionally apply internally.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { agentmailManifest } from './manifest.js';

export const agentmailAnchor: ProviderAnchor = {
  provider: 'agentmail',
  packages: [
    ...new Set([...(agentmailManifest.detect.packages ?? []), ...(agentmailManifest.detect.imports ?? [])]),
  ],
  // `AgentMail` is the Python SDK's client class; in TS it is only a types
  // namespace (`export * as AgentMail`), so it is not a constructor here.
  clientConstructors: ['AgentMailClient'],
  clientNamePattern: /agent[._-]?mail/i,
  wrapperSourcePattern: /agent[._-]?mail/i,
  urlSubstrings: [...(agentmailManifest.detect.urlPatterns ?? [])],
  tokenPattern: /AGENTMAIL_/,
};
