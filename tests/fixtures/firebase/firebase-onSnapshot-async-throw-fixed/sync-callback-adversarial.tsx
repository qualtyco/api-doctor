import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Adversarial: sync callback (no async) — throw propagates normally to ProseMirror's error boundary
// This is different from the async case where throw becomes an unhandled rejection.
export function listenSync(docId: string) {
  const docRef = doc(db, 'documents', docId);

  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }
    return docSnap.data();
  });
}
