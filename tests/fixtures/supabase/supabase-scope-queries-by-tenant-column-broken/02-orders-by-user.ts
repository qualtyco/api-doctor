import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Different table/column than the session_id example: selects user_id but
// filters on nothing, so the admin dashboard endpoint leaks every user's orders.
export async function listRecentOrders() {
  const { data } = await supabase
    .from('orders')
    .select('id, user_id, total, created_at')
    .order('created_at', { ascending: false });
  return data;
}
