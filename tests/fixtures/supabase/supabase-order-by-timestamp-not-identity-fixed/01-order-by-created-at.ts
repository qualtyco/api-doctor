import { getSupabase } from '../../../lib/supabase.js';

// Orders by the purpose-built timestamp column instead of the surrogate key.
export async function GET() {
  const { data, error } = await getSupabase()
    .from('calculations')
    .select('id, expression, result, explanation, session_id, created_at')
    .eq('session_id', 'abc')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: 'Failed to load history' }, { status: 500 });
  return Response.json({ data });
}
