import { getSupabase } from '../../../lib/supabase.js';

// All three sibling fields have an explicit length cap.
export async function POST(request: Request) {
  const { expression, result, explanation } = await request.json();

  if (typeof expression !== 'string' || expression.length > 200) {
    return Response.json({ error: 'Invalid expression' }, { status: 400 });
  }
  if (typeof result !== 'string' || result.length > 100) {
    return Response.json({ error: 'Invalid result' }, { status: 400 });
  }
  if (typeof explanation !== 'string' || explanation.length > 2000) {
    return Response.json({ error: 'Invalid explanation' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ expression, result, explanation })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
