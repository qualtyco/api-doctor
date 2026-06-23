/**
 * Central registry of API providers. Each manifest declares how to detect
 * the SDK in a project and which oxlint rules to enable when found.
 */
import type { ProviderManifest } from '../types.js';
import { resendManifest } from './resend/manifest.js';
import { supabaseManifest } from './supabase/manifest.js';
import { auth0Manifest } from './auth0/manifest.js';
import { firebaseManifest } from './firebase/manifest.js';
import { lovableManifest } from './lovable/manifest.js';
import { browserbaseManifest } from './browserbase/manifest.js';
import { openaiCuaManifest } from './openai-cua/manifest.js';

export const providers: ProviderManifest[] = [
  resendManifest,
  supabaseManifest,
  auth0Manifest,
  firebaseManifest,
  lovableManifest,
  browserbaseManifest,
  openaiCuaManifest,
];
