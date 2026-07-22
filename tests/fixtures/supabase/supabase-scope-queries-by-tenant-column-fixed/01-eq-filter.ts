import { getSupabase } from '../../../lib/supabase.js';

// Scoped with an explicit .eq() on the tenant column.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');

  const { data, error } = await getSupabase()
    .from('calculations')
    .select('id, expression, result, explanation, session_id, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: 'Failed to load history' }, { status: 500 });
  return Response.json({ data });
}
