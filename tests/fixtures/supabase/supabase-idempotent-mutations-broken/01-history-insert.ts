import { getSupabase } from '../../../lib/supabase.js';

// .insert().select().single() is the right round-trip pattern, but nothing
// guards against a retried fetch creating a duplicate calculation row.
export async function POST(request: Request) {
  const { expression, result } = await request.json();

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ expression, result })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
