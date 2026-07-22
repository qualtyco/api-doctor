import { supabase } from '../integrations/supabase/client';
import { stripeConfirmPayment } from '../lib/stripe';

// Looks like the broken shape (a direct .update() setting is_boosted), but
// payment is confirmed with the provider first, in the same handler.
export function ProjectCard({ projectId, sessionId }: { projectId: string; sessionId: string }) {
  async function confirmBoost() {
    await stripeConfirmPayment(sessionId);
    const boostedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('projects')
      .update({ is_boosted: true, boosted_until: boostedUntil })
      .eq('id', projectId);
  }

  return <button onClick={confirmBoost}>Feature for $3</button>;
}
