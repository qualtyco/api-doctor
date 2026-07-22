import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function listenToDocument(docId: string, onUpdate: (data: any) => void, onError: (err: Error) => void) {
  const docRef = doc(db, 'documents', docId);

  return onSnapshot(
    docRef,
    async (docSnap) => {
      if (!docSnap.exists()) {
        // Return instead of throw — error handled via the error callback pattern
        console.error('Document not found:', docId);
        onError(new Error('Document not found'));
        return;
      }
      onUpdate(docSnap.data());
    },
    (error) => {
      console.error('Snapshot error:', error.code, error.message);
      onError(error);
    },
  );
}
