import { getSupabase } from '../../../lib/supabase.js';

// Optional-field pattern from the real sample app: explanation is capped,
// but the insert payload value for a sibling field is `note ?? null`
// (LogicalExpression), not a bare identifier — the rule must still resolve
// it back to the uncapped, typeof-only-checked variable.
export async function POST(request: Request) {
  const { explanation, note } = await request.json();

  if (typeof explanation !== 'string' || explanation.length > 2000) {
    return Response.json({ error: 'Invalid explanation' }, { status: 400 });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return Response.json({ error: 'Invalid note' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ explanation, note: note ?? null })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
