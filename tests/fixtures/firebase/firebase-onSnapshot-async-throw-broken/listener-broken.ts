import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function subscribeToDocuments(userId: string) {
  const q = query(collection(db, 'documents'));

  return onSnapshot(q, async (snapshot) => {
    for (const docSnap of snapshot.docs) {
      if (!docSnap.exists()) {
        throw new Error(`Document ${docSnap.id} does not exist`);
      }
    }
  });
}
