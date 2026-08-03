/**
 * Registry of per-provider anchors. Each provider owns its anchor definition
 * in its own folder (src/providers/<name>/anchor.ts) — this file only
 * aggregates them, mirroring how src/providers/index.ts aggregates manifests.
 */
import type { ProviderAnchor } from '../types.js';
import { resendAnchor } from '../providers/resend/anchor.js';
import { supabaseAnchor } from '../providers/supabase/anchor.js';
import { auth0Anchor } from '../providers/auth0/anchor.js';
import { firebaseAnchor } from '../providers/firebase/anchor.js';
import { browserbaseAnchor } from '../providers/browserbase/anchor.js';
import { openaiAnchor } from '../providers/openai/anchor.js';
import { tiptapAnchor } from '../providers/tiptap/anchor.js';
import { elevenlabsAnchor } from '../providers/elevenlabs/anchor.js';
import { twilioAnchor } from '../providers/twilio/anchor.js';
import { openaiRealtimeAnchor } from '../providers/openai-realtime/anchor.js';
import { s2Anchor } from '../providers/s2/anchor.js';
import { agentmailAnchor } from '../providers/agentmail/anchor.js';

export const ALL_ANCHORS: ProviderAnchor[] = [
  resendAnchor,
  supabaseAnchor,
  auth0Anchor,
  firebaseAnchor,
  browserbaseAnchor,
  openaiAnchor,
  tiptapAnchor,
  elevenlabsAnchor,
  twilioAnchor,
  openaiRealtimeAnchor,
  s2Anchor,
  agentmailAnchor,
];

const anchorByProvider = new Map(ALL_ANCHORS.map((a) => [a.provider, a]));

/** Anchor for one provider; throws on unknown names so drift fails loudly. */
export function anchorFor(provider: string): ProviderAnchor {
  const anchor = anchorByProvider.get(provider);
  if (!anchor) throw new Error(`anchors.ts: unknown provider "${provider}"`);
  return anchor;
}
