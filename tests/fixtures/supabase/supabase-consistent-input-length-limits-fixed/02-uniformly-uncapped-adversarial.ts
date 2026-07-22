import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Adversarial: neither sibling field has a length cap. This could look like
// the same "missing cap" problem at a glance, but this rule is specifically
// about *inconsistency* between siblings (one capped, one not) — uniformly
// uncapped fields are a different, broader concern out of scope here, so
// this must not be flagged.
export async function saveComment(title: string, rawBody: unknown) {
  if (typeof title !== 'string') {
    throw new Error('title must be a string');
  }
  if (typeof rawBody !== 'string') {
    throw new Error('body must be a string');
  }

  return supabase.from('comments').upsert({ title, body: rawBody });
}
