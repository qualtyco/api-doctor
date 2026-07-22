import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';

export function useUserPreferences() {
  const { user } = useAuth();
  const userId = user?.uid ?? '';

  async function fetchPrefs() {
    if (!userId) return null;
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    return snap.data();
  }

  return { fetchPrefs };
}
