import { supabase } from '../integrations/supabase/client';

export function ProjectCard({ projectId }: { projectId: string }) {
  async function confirmBoost() {
    // Server-side Edge Function creates the Stripe Checkout session and the
    // webhook flips is_boosted after payment is confirmed — the client
    // never writes the flag directly.
    await supabase.functions.invoke('create-boost-checkout', {
      body: { projectId },
    });
  }

  return <button onClick={confirmBoost}>Feature for $3</button>;
}
