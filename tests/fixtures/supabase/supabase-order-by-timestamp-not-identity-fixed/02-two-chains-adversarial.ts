import { getSupabase } from '../../../lib/supabase.js';

// Adversarial: two separate query chains close together in the same file.
// Chain A orders by "id" but selects no timestamp column at all, so the
// rule must not flag it. Chain B selects created_at but already orders by
// created_at itself. A naive file-level (rather than per-chain) tracker
// could wrongly let chain B's timestamp column "leak" into chain A's
// order-by-id check — this fixture proves chain isolation holds.
export async function listLogsAndEvents() {
  const logs = await getSupabase().from('logs').select('id, level').order('id', { ascending: false });

  const events = await getSupabase()
    .from('events')
    .select('id, created_at')
    .order('created_at', { ascending: false });

  return { logs: logs.data, events: events.data };
}
