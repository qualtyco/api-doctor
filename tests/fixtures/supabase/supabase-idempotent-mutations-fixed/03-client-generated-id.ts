import { supabase } from '../client.js';

// A client-generated primary key IS the idempotency key: a retried request
// re-sends the same id and hits the PK constraint instead of duplicating.
export async function addTask(title: string) {
  return supabase.from('tasks').insert({ id: crypto.randomUUID(), title });
}
