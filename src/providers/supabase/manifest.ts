import type { ProviderManifest } from '../../types.js';

/** Detect-only — lint rules not implemented yet. */
export const supabaseManifest: ProviderManifest = {
  name: 'supabase',
  displayName: 'Supabase',
  detect: {
    packages: ['@supabase/supabase-js'],
    imports: ['@supabase/supabase-js'],
    urlPatterns: ['supabase.co'],
  },
  oxlintRules: [],
};
