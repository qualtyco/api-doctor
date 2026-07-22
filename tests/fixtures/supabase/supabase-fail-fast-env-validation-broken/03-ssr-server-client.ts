import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// @supabase/ssr factory with unguarded env vars — same failure mode as
// createClient: the SDK error names its parameter, not the env var.
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
    },
  });
}
