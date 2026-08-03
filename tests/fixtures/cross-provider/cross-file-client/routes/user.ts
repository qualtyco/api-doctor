// Nothing in this file names the provider. Only the CLI's cross-file client
// resolution can know `db` is a Supabase client — a per-file gate goes dark
// here and loses the real finding below.
import { db } from '../lib/db.js';

export async function recordVisit(userId: string, page: string) {
  await db.from('page_visits').insert({ user_id: userId, page });
}
