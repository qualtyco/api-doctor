import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Different shape: title is capped at 80 chars, but body (renamed property,
// not shorthand) has no cap at all.
export async function saveComment(title: string, rawBody: unknown) {
  if (typeof title !== 'string' || title.length > 80) {
    throw new Error('title too long');
  }
  if (typeof rawBody !== 'string') {
    throw new Error('body must be a string');
  }

  return supabase.from('comments').upsert({ title, body: rawBody });
}
