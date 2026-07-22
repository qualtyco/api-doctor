import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Different table/column (updated_at instead of created_at), and ascending
// order rather than descending — still orders by the surrogate key.
export async function listRecentlyUpdatedMessages() {
  const { data } = await supabase
    .from('messages')
    .select('id, body, updated_at')
    .order('id', { ascending: true });
  return data;
}
