/**
 * Central registry of API providers. Each manifest declares how to detect
 * the SDK in a project, which oxlint rules to enable when found, and — when
 * someone has hand-verified them — which SDK symbols have been removed.
 */
import type { MethodRemoval, ProviderManifest, SymbolRemoval } from '../types.js';
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
 * Every provider's hand-verified removals, derived from the registry above
 * rather than listed again.
 *
 * Two lists because an SDK breaks a caller in two shapes — a removed export
 * (`allRemovals`) and a removed method path off a client (`allMethodRemovals`)
 * — and the detectors for them are necessarily different. Everything
 * downstream wants them together, which is what `everyRemoval` is for.
 *
 * Compatibility findings render their facts into a message string, so the
 * structured removal (replacement, wireIdentical, verifyHint) is not
 * recoverable from the report alone. Consumers that need it — telemetry, and
 * the reporter's Verify line — recover the name from the message and look it
 * up here.
 *
 * This is derivation, not a second registry: a provider's removals live in
 * `providers/<name>/compatibility.ts` and reach these maps by being declared
 * on that provider's own manifest. There is nothing here to forget to update.
 */
export const allRemovals: SymbolRemoval[] = providers.flatMap(
  (p) => p.compatibility?.removals ?? [],
);

export const allMethodRemovals: MethodRemoval[] = providers.flatMap(
  (p) => p.compatibility?.methodRemovals ?? [],
);

/** Both shapes in one list, for the consumers that do not care which is which. */
export const everyRemoval: Array<SymbolRemoval | MethodRemoval> = [
  ...allRemovals,
  ...allMethodRemovals,
];

/**
 * What a removal is called in a rendered message: the exported symbol, or the
 * dotted method path. Both lead their message, so both are the lookup key.
 */
export function removalName(removal: SymbolRemoval | MethodRemoval): string {
  return 'symbol' in removal ? removal.symbol : removal.path;
}

export const removalsBySymbol = new Map(everyRemoval.map((r) => [removalName(r), r]));

/** Providers carrying compatibility data, for consumers that need the package. */
export const compatProviders = providers.filter((p) => p.compatibility);

/**
 * Recovers the removed symbol or method path from a rendered compatibility
 * message, which always leads with it. Returns null for anything outside the
 * known set — including the static fallback message used when a rule yields
 * no text.
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
