import { supabase } from '../client.js';

// Adversarial: whole result object bound, .error checked on it.
export async function loadProject(id: string) {
  const result = await supabase.from('projects').select('*').eq('id', id).single();
  if (result.error) throw result.error;
  return result.data;
}
