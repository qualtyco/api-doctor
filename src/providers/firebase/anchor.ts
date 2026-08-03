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
  // Matches wrapper modules whose final path segment is firebase-flavored:
  // `lib/firebase`, `firebase-admin.ts`, and hook-style wrappers such as
  // `@/hooks/use-firebase-storage` (a `use-`/`use_` prefix plus any dashed
  // suffix words). The segment must still contain a standalone "firebase" —
  // `use-storage` or `fire-base` never match.
  wrapperSourcePattern: /(^|\/)(use[-_])?firebase([-_.]\w+)*(\.[cm]?[jt]sx?)?$/i,
  urlSubstrings: [...(firebaseManifest.detect.urlPatterns ?? [])],
  tokenPattern: /FIREBASE_/,
};
