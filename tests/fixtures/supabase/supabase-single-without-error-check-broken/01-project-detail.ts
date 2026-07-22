import { supabase } from '../client.js';

export async function loadProject(id: string) {
  const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single();
  return proj;
}
