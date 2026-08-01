/**
 * Twilio anchor: evidence tying a file or call receiver to Twilio.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { twilioManifest } from './manifest.js';

export const twilioAnchor: ProviderAnchor = {
  provider: 'twilio',
  packages: [
    ...new Set([...(twilioManifest.detect.packages ?? []), ...(twilioManifest.detect.imports ?? [])]),
  ],
  // twilio-node v6 exports no `RequestValidator` class — webhook validation
  // ships as validateRequest/validateExpressRequest functions, whose usage is
  // covered by the token axis below.
  clientConstructors: ['Twilio'],
  // `import twilio from 'twilio'` — the default export is itself the factory.
  defaultIsFactory: true,
  clientNamePattern: /^twilio\w*$/i,
  wrapperSourcePattern: /(^|\/)twilio(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(twilioManifest.detect.urlPatterns ?? [])],
  tokenPattern:
    /twiml|x-twilio-signature|TWILIO_|MessagingResponse|VoiceResponse|taskrouter|CallSid|StreamSid/i,
};
