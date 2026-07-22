import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Array-form insert (multiple rows at once), still no dedupe key on any row.
export async function recordOrders(orders: { sku: string; qty: number }[]) {
  return supabase.from('orders').insert(orders.map((o) => ({ sku: o.sku, qty: o.qty })));
}
