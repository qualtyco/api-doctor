import { supabase } from '../integrations/supabase/client';

// Looks like the broken shape (a single .update() writing boosted_until,
// no inline comparison nearby), but a scheduled cleanup query elsewhere in
// this same file filters on it via a PostgREST .lt() call.
export function ProjectCard({ projectId }: { projectId: string }) {
  async function confirmBoost() {
    const boostedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('projects')
      .update({ is_boosted: true, boosted_until: boostedUntil })
      .eq('id', projectId);
  }

  async function unboostExpiredProjects() {
    const nowIso = new Date().toISOString();
    await supabase.from('projects').update({ is_boosted: false }).lt('boosted_until', nowIso);
  }

  return null;
}
