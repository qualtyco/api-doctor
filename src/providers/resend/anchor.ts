/**
 * Resend anchor: evidence tying a file or call receiver to Resend.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts) so Resend
 * rules never fire on files/calls that belong to another provider.
 */
import type { ProviderAnchor } from '../../types.js';
import { resendManifest } from './manifest.js';

export const resendAnchor: ProviderAnchor = {
  provider: 'resend',
  packages: [
    ...new Set([...(resendManifest.detect.packages ?? []), ...(resendManifest.detect.imports ?? [])]),
    // Resend webhooks are Svix-signed; svix usage is Resend evidence even in
    // handler files that never import the resend SDK.
    'svix',
  ],
  clientConstructors: ['Resend'],
  clientNamePattern: /^resend([-_]?client)?$/i,
  wrapperSourcePattern: /(^|\/)resend(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(resendManifest.detect.urlPatterns ?? [])],
  tokenPattern:
    /svix-id|svix-signature|svix-timestamp|RESEND_API_KEY|email\.(sent|delivered|delivery_delayed|bounced|complained|opened|clicked)|contact\.(created|updated|deleted)/i,
};
