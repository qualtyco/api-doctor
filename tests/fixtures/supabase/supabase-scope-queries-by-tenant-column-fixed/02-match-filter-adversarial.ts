import { getSupabase } from '../../../lib/supabase.js';

// Adversarial: no .eq() call anywhere in the chain, which could look
// unscoped at a glance — but .match() filters by session_id just as
// effectively, so this must not be flagged.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');

  const { data, error } = await getSupabase()
    .from('calculations')
    .select('id, expression, result, explanation, session_id, created_at')
    .match({ session_id: sessionId })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: 'Failed to load history' }, { status: 500 });
  return Response.json({ data });
}
