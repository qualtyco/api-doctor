import { getSupabase } from '../../../lib/supabase.js';

// expression and result are capped, but explanation (the field most likely
// to hold large LLM-generated free text) is only type-checked.
export async function POST(request: Request) {
  const { expression, result, explanation } = await request.json();

  if (typeof expression !== 'string' || expression.length > 200) {
    return Response.json({ error: 'Invalid expression' }, { status: 400 });
  }
  if (typeof result !== 'string' || result.length > 100) {
    return Response.json({ error: 'Invalid result' }, { status: 400 });
  }
  if (typeof explanation !== 'string') {
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
