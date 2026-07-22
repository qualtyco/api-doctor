import { getSupabase } from '../../../lib/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validates both that it's a string AND that it has UUID shape.
export async function POST(request: Request) {
  const { session_id, expression } = await request.json();

  if (typeof session_id !== 'string' || !UUID_RE.test(session_id)) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ session_id, expression })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
