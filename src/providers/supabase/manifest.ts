import type { ProviderManifest } from '../../types.js';

/** Detection-only for now — rules not implemented yet. */
export const supabaseManifest: ProviderManifest = {
  name: 'supabase',
  displayName: 'Supabase',
  detect: {
    packages: ['@supabase/supabase-js', '@supabase/ssr'],
    imports: ['@supabase/supabase-js', '@supabase/ssr'],
    urlPatterns: ['supabase.co'],
  },
  oxlintRules: [],
};
