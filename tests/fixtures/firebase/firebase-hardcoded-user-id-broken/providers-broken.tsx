import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function getUserPreferences() {
  // Hardcoded — every user reads/writes the same document
  const userId = 'demoUser123';
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  return snap.data();
}
