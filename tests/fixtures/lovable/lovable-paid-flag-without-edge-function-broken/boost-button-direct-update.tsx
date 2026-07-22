import { supabase } from '../integrations/supabase/client';

export function ProjectCard({ projectId }: { projectId: string }) {
  async function confirmBoost() {
    const boostedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('projects')
      .update({ is_boosted: true, boosted_until: boostedUntil })
      .eq('id', projectId);
  }

  return <button onClick={confirmBoost}>Feature for $3</button>;
}
