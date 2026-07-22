import { supabase } from '../client.js';

// Adversarial: .throwOnError() opts into exceptions — a PGRST116 (zero or
// multiple rows) throws, so no { error } check is needed.
export async function loadProject(id: string) {
  const { data } = await supabase.from('projects').select('*').eq('id', id).single().throwOnError();
  return data;
}
