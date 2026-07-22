import { supabase } from '../client.js';

// Adversarial: the whole result object is bound and .error is checked on it —
// idiomatic error handling without destructuring at the await site.
export async function addTask(title: string) {
  const res = await supabase.from('tasks').insert({ title });
  if (res.error) throw res.error;
}

// Also fine: destructuring error from the result object afterwards.
export async function removeTask(id: string) {
  const result = await supabase.from('tasks').delete().eq('id', id);
  const { error } = result;
  if (error) throw error;
}
