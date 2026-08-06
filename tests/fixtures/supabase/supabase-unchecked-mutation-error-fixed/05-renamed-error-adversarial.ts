import { supabase } from '../client.js';

// Adversarial: two mutations in one scope force the error bindings to be
// renamed. `error: insertError` still destructures `error` — matching on the
// local name would flag correctly written code.
export async function replaceTask(id: string, title: string) {
  const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from('tasks').insert({ id, title });
  if (insertError) throw insertError;
}

// Also fine: renamed error destructured from the result object afterwards.
export async function archiveTask(id: string) {
  const result = await supabase.from('tasks').update({ archived: true }).eq('id', id);
  const { error: updateError } = result;
  if (updateError) throw updateError;
}
