import { getSupabase } from '../../../lib/supabase.js';

// Optional-field pattern from the real sample app: the insert payload value
// is `session_id ?? null`, not a bare identifier or shorthand property —
// the rule must still trace it back to the typeof-only-checked variable.
export async function POST(request: Request) {
  const { session_id, expression } = await request.json();

  if (session_id !== undefined && session_id !== null && typeof session_id !== 'string') {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ expression, session_id: session_id ?? null })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
