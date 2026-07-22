import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function subscribeToCollection(path: string, onData: (docs: any[]) => void) {
  return onSnapshot(collection(db, path), (snapshot) => {
    onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
