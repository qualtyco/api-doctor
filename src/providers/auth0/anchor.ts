/**
 * Auth0 anchor: evidence tying a file or call receiver to Auth0.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { auth0Manifest } from './manifest.js';

export const auth0Anchor: ProviderAnchor = {
  provider: 'auth0',
  packages: [
    ...new Set([...(auth0Manifest.detect.packages ?? []), ...(auth0Manifest.detect.imports ?? [])]),
    'auth0',
    '@auth0/',
  ],
  clientConstructors: ['ManagementClient', 'AuthenticationClient', 'JwksClient'],
  clientNamePattern: /^auth0/i,
  wrapperSourcePattern: /(^|\/)auth0(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(auth0Manifest.detect.urlPatterns ?? [])],
  tokenPattern: /AUTH0_|\.auth0\.com/i,
};
