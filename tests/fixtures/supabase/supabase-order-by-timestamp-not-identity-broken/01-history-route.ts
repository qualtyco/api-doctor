import { getSupabase } from '../../../lib/supabase.js';

// "Most recent first" implemented via the surrogate id key even though
// created_at (selected in the same query) exists for exactly this purpose.
export async function GET() {
  const { data, error } = await getSupabase()
    .from('calculations')
    .select('id, expression, result, explanation, session_id, created_at')
    .eq('session_id', 'abc')
    .order('id', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: 'Failed to load history' }, { status: 500 });
  return Response.json({ data });
}
