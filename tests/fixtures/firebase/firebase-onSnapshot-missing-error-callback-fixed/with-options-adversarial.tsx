import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Adversarial: 4 args with options object + error callback — should NOT flag
export function listenWithOptions(docId: string, onData: (d: any) => void, onErr: (e: Error) => void) {
  const docRef = doc(db, 'documents', docId);

  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snap) => { onData(snap.data()); },
    (err) => { onErr(err); },
  );
}
