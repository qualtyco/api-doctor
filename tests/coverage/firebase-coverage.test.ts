import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'firebase');

function detectedFirebase(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'firebase', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (firebase)', () => {
  it('records instance methods on a service verified through its modular factory', () => {
    const files = contents({
      'src/auth.ts': `
        import { initializeApp } from 'firebase/app';
        import { getAuth } from 'firebase/auth';
        const app = initializeApp({ projectId: 'demo' });
        const auth = getAuth(app);
        auth.onAuthStateChanged((user) => console.log(user?.uid));
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/auth.ts']), files);
    expect(coverage).toEqual([
      { provider: 'firebase', used: ['onAuthStateChanged'], unknownSdkCalls: 0 },
    ]);
  });

  it('records calls made directly on a factory result', () => {
    const files = contents({
      'src/ready.ts': `
        import { getAuth } from 'firebase/auth';
        await getAuth().authStateReady();
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/ready.ts']), files);
    expect(coverage?.[0].used).toEqual(['authStateReady']);
  });

  it('records currentUser.* paths, including through a namespace import', () => {
    const files = contents({
      'src/token.ts': `
        import * as fbAuth from 'firebase/auth';
        const auth = fbAuth.getAuth();
        const token = await auth.currentUser.getIdToken(true);
        await auth.currentUser?.getIdTokenResult();
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/token.ts']), files);
    expect(coverage?.[0].used).toEqual(['currentUser.getIdToken', 'currentUser.getIdTokenResult']);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/firebase.ts': `
        import { initializeApp } from 'firebase/app';
        import { getAuth } from 'firebase/auth';
        export const app = initializeApp({ projectId: 'demo' });
        export const auth = getAuth(app);
      `,
      'src/logout.ts': `
        import { auth } from '@/lib/firebase';
        export async function logout() {
          await auth.signOut();
        }
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/lib/firebase.ts']), files);
    expect(coverage?.[0].used).toEqual(['signOut']);
  });

  it('never records modular free functions — they have no client root', () => {
    const files = contents({
      'src/login.ts': `
        import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
        import { collection, getFirestore } from 'firebase/firestore';
        const auth = getAuth();
        const db = getFirestore();
        await signInWithEmailAndPassword(auth, 'a@b.co', 'secret');
        const users = collection(db, 'users');
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/login.ts']), files);
    // Structurally invisible, not unknown: a free-function call has no member
    // chain, so it is never recorded at all.
    expect(coverage).toEqual([{ provider: 'firebase', used: [], unknownSdkCalls: 0 }]);
  });

  it('counts compat-style calls on a verified modular instance as unknown, never used', () => {
    const files = contents({
      'src/legacy.ts': `
        import { getAuth } from 'firebase/auth';
        import { getDatabase } from 'firebase/database';
        const auth = getAuth();
        const db = getDatabase();
        await auth.signInWithEmailAndPassword('a@b.co', 'secret');
        db.ref('messages');
      `,
    });
    const coverage = collectCoverage(detectedFirebase(['src/legacy.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://demo-default-rtdb.firebaseio.com/messages.json');`,
    });
    const coverage = collectCoverage(detectedFirebase(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (firebase)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('firebase');
    // onAuthStateChanged + currentUser.getIdToken via the '@/lib/firebase'
    // wrapper alias, setPersistence + signOut from the renamed factory import,
    // updateCurrentUser via dynamic access, toJSON on the Firestore instance.
    // The reference-only auth.signOut, the aliased currentUser.reload, the
    // wrong-root onAuthStateChanged on a plain object, the modular free
    // functions, and the test-file onIdTokenChanged must all be absent.
    expect(coverage?.[0].used).toEqual([
      'currentUser.getIdToken',
      'onAuthStateChanged',
      'setPersistence',
      'signOut',
      'toJSON',
      'updateCurrentUser',
    ]);
    // The compat-style rtdb.ref() on a verified modular Database instance is
    // the one unknown SDK call in the fixture.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('firebase');
    expect(detected.find((d) => d.name === 'firebase')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
