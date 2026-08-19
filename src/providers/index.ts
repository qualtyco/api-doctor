/**
 * Central registry of API providers. Each manifest declares how to detect
 * the SDK in a project, which oxlint rules to enable when found, and — when
 * someone has hand-verified them — which SDK symbols have been removed.
 */
import type { ProviderManifest, SymbolRemoval } from '../types.js';
import { resendManifest } from './resend/manifest.js';
import { supabaseManifest } from './supabase/manifest.js';
import { auth0Manifest } from './auth0/manifest.js';
import { firebaseManifest } from './firebase/manifest.js';
import { browserbaseManifest } from './browserbase/manifest.js';
import { openaiManifest } from './openai/manifest.js';
import { tiptapManifest } from './tiptap/manifest.js';
import { elevenlabsManifest } from './elevenlabs/manifest.js';
import { twilioManifest } from './twilio/manifest.js';
import { openaiRealtimeManifest } from './openai-realtime/manifest.js';
import { s2Manifest } from './s2/manifest.js';
import { agentmailManifest } from './agentmail/manifest.js';

export const providers: ProviderManifest[] = [
  resendManifest,
  supabaseManifest,
  auth0Manifest,
  firebaseManifest,
  browserbaseManifest,
  openaiManifest,
  tiptapManifest,
  elevenlabsManifest,
  twilioManifest,
  openaiRealtimeManifest,
  s2Manifest,
  agentmailManifest,
];

/**
 * Every provider's hand-verified symbol removals, derived from the registry
 * above rather than listed again.
 *
 * Compatibility findings render their facts into a message string, so the
 * structured removal (replacement, wireIdentical, verifyHint) is not
 * recoverable from the report alone. Consumers that need it — telemetry, and
 * the reporter's Verify line — recover the symbol from the message and look it
 * up here.
 *
 * This is derivation, not a second registry: a provider's removals live in
 * `providers/<name>/compatibility.ts` and reach this map by being declared on
 * that provider's own manifest. There is nothing here to forget to update.
 */
export const allRemovals: SymbolRemoval[] = providers.flatMap(
  (p) => p.compatibility?.removals ?? [],
);

export const removalsBySymbol = new Map(allRemovals.map((r) => [r.symbol, r]));

/** Providers carrying compatibility data, for consumers that need the package. */
export const compatProviders = providers.filter((p) => p.compatibility);

/**
 * Recovers the removed symbol from a rendered compatibility message, which
 * always leads with it. Returns null for anything outside the known set —
 * including the static fallback message used when a rule yields no text.
 *
 * Matching against a closed vocabulary is what makes that safe: an
 * unrecognised leading token yields null rather than a guess, so nothing
 * arbitrary is ever read out of a message.
 */
export function symbolFromMessage(message: string): string | null {
  const [first] = message.split(/\s/, 1);
  return first && removalsBySymbol.has(first) ? first : null;
}

/**
 * The hand-written verification hint for a rendered compatibility message, or
 * undefined when the message names no known removal.
 *
 * Same closed-vocabulary guarantee as `symbolFromMessage`: an unrecognised
 * message yields nothing rather than a guess, so the reporters either show a
 * verified hint or show no Verify line at all.
 */
export function verifyHintFromMessage(message: string): string | undefined {
  const symbol = symbolFromMessage(message);
  return symbol ? removalsBySymbol.get(symbol)?.verifyHint : undefined;
}
