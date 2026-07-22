import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Adversarial: the payload's field is named "client_key", not anything
// containing "idempotency" or "dedupe" — a naive name-only check might miss
// that this is the dedupe key. But it's .upsert() with onConflict pointing
// at that very column, which is the documented retry-safe pattern, so this
// must not be flagged regardless of the field's name.
export async function recordOrder(clientKey: string, sku: string) {
  return supabase
    .from('orders')
    .upsert({ client_key: clientKey, sku }, { onConflict: 'client_key' });
}
