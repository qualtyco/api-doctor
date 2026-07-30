import { auth } from '@/lib/firebase';

export function watchSession(onUser: (uid: string | null) => void) {
  return auth.onAuthStateChanged(
    (user) => onUser(user ? user.uid : null),
    (error) => console.error('auth listener failed', error),
  );
}

export async function currentToken(): Promise<string | null> {
  return (await auth.currentUser?.getIdToken()) ?? null;
}
