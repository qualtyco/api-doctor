/**
 * Firebase anchor: evidence tying a file or call receiver to Firebase.
 * Consumed by the plugin's provider gate (src/plugin/gate.ts).
 */
import type { ProviderAnchor } from '../../types.js';
import { firebaseManifest } from './manifest.js';

export const firebaseAnchor: ProviderAnchor = {
  provider: 'firebase',
  packages: [
    ...new Set([...(firebaseManifest.detect.packages ?? []), ...(firebaseManifest.detect.imports ?? [])]),
    'firebase-admin',
  ],
  clientConstructors: [
    'initializeApp',
    'getAuth',
    'initializeAuth',
    'getFirestore',
    'initializeFirestore',
    'getDatabase',
    'getStorage',
    'getFunctions',
    'getApp',
  ],
  clientNamePattern: /firebase/i,
  wrapperSourcePattern: /(^|\/)firebase([-_.]?(app|config|client|admin))?(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(firebaseManifest.detect.urlPatterns ?? [])],
  tokenPattern: /FIREBASE_/,
};
