import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function listenToDoc(docId: string, setSaveStatus: (s: string) => void) {
  const docRef = doc(db, 'documents', docId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        setSaveStatus('Saved ✅');
      }
    },
    (error) => {
      console.error('Snapshot error:', error.code, error.message);
      setSaveStatus('Connection error ⚠️');
    },
  );
}
