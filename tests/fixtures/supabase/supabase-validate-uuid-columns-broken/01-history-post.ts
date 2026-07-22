import { getSupabase } from '../../../lib/supabase.js';

// session_id is validated only as `typeof === "string"` — any non-UUID
// string passes app validation, then fails at the database with an opaque
// type-cast error since the column is typed uuid.
export async function POST(request: Request) {
  const { session_id, expression } = await request.json();

  if (typeof session_id !== 'string') {
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
