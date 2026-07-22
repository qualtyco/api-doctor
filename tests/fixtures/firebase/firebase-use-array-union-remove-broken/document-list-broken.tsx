import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function removeDocument(userId: string, docId: string) {
  const userDocRef = doc(db, 'userCollections', userId);
  const snap = await getDoc(userDocRef);
  const existingDocs: string[] = snap.data()?.documents ?? [];

  // Filter-based removal — non-atomic, races with concurrent writes
  await updateDoc(userDocRef, {
    documents: existingDocs.filter((id) => id !== docId),
  });
}
