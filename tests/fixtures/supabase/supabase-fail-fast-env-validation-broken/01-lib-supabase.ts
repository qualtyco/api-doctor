import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | undefined;

// No presence check on either env var — a missing one surfaces later as an
// opaque error deep in a fetch call instead of a clear message at startup.
export function getSupabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return client;
}
