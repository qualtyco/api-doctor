import { supabase } from '../client.js';

// Adversarial: .throwOnError() is the documented opt-in to exception-style
// handling — a rejected mutation throws, so no { error } check is needed.
export async function addTask(title: string) {
  await supabase.from('tasks').insert({ title }).throwOnError();
}
