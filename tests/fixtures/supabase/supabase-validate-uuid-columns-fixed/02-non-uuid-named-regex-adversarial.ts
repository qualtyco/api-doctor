import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Adversarial: the regex variable isn't named "UUID_RE" or anything with
// "uuid" in it, which could fool a naive name-based check — but its pattern
// is still UUID-shaped (hex groups + hyphens), so this is correctly validated
// and must not be flagged.
const ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function linkAccount(rawAccountId: unknown) {
  if (typeof rawAccountId !== 'string' || !ID_FORMAT.test(rawAccountId)) {
    throw new Error('account_id must be a valid UUID');
  }

  return supabase
    .from('accounts')
    .upsert({ account_id: rawAccountId, linked_at: new Date().toISOString() });
}
