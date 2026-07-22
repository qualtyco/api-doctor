import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Adversarial: updateDoc with no getJSON() — plain metadata update, should NOT flag
export async function updateDocumentTitle(docId: string, title: string) {
  const docRef = doc(db, 'documents', docId);
  await updateDoc(docRef, {
    title,
    updatedAt: Timestamp.now(),
  });
}
