import { getSupabase } from '../../../lib/supabase.js';

// Selects session_id (clearly intended to scope the feed) but never filters
// by it — every visitor sees the same shared, cross-session history.
export async function GET() {
  const { data, error } = await getSupabase()
    .from('calculations')
    .select('id, expression, result, explanation, session_id, created_at')
    .order('id', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: 'Failed to load history' }, { status: 500 });
  return Response.json({ data });
}
