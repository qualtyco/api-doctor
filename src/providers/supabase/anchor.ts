/**
 * Supabase anchor: evidence tying a file or call receiver to Supabase.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { supabaseManifest } from './manifest.js';

export const supabaseAnchor: ProviderAnchor = {
  provider: 'supabase',
  packages: [
    ...new Set([...(supabaseManifest.detect.packages ?? []), ...(supabaseManifest.detect.imports ?? [])]),
    '@supabase/',
  ],
  clientConstructors: ['createClient', 'createBrowserClient', 'createServerClient'],
  clientNamePattern: /^supabase([-_]?(client|admin))?$/i,
  wrapperSourcePattern: /(^|\/)supabase([-_.]?client)?(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(supabaseManifest.detect.urlPatterns ?? [])],
  tokenPattern: /SUPABASE_(URL|ANON_KEY|SERVICE_ROLE)/i,
};
