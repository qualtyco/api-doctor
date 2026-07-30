import { createServerClient } from '@supabase/ssr';

// @supabase/ssr factories return the same SupabaseClient — auth.getUser must
// be attributed to the supabase surface.
export async function getSessionUser(cookies: { getAll(): { name: string; value: string }[] }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  const client = createServerClient(url, key, {
    cookies: { getAll: () => cookies.getAll(), setAll: () => {} },
  });
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}
