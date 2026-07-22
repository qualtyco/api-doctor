import { getSupabase } from '../../../lib/supabase.js';

// Client-generated idempotency key included as a field, backed by a unique
// constraint on idempotency_key in the migration.
export async function POST(request: Request) {
  const { expression, result, idempotencyKey } = await request.json();

  const { data, error } = await getSupabase()
    .from('calculations')
    .insert({ expression, result, idempotency_key: idempotencyKey })
    .select()
    .single();

  if (error) return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
  return Response.json({ data });
}
