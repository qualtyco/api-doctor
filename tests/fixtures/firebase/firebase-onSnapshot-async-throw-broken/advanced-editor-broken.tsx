import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function listenToDocument(docId: string, onUpdate: (data: any) => void) {
  const docRef = doc(db, 'documents', docId);

  // async callback — throw becomes unhandled promise rejection
  const unsubscribe = onSnapshot(docRef, async (docSnap) => {
    if (!docSnap.exists()) {
      throw new Error('Document not found.');
    }

    const data = docSnap.data();
    if (!data?.content) {
      throw new Error('Invalid document structure.');
    }

    onUpdate(data);
  });

  return unsubscribe;
}
