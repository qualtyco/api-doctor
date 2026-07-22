import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function listenToDoc(docId: string, setSaveStatus: (s: string) => void) {
  const docRef = doc(db, 'documents', docId);

  // Only success callback — permission errors silently stop the listener
  const unsub = onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      setSaveStatus('Saved ✅');
    }
  });

  return unsub;
}
