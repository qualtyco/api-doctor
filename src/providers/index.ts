/**
 * Central registry of API providers. Each manifest declares how to detect
 * the SDK in a project and which oxlint rules to enable when found.
 */
import type { ProviderManifest } from '../types.js';
import { resendManifest } from './resend/manifest.js';
import { stripeManifest } from './stripe/manifest.js';
import { supabaseManifest } from './supabase/manifest.js';

export const providers: ProviderManifest[] = [resendManifest, stripeManifest, supabaseManifest];
