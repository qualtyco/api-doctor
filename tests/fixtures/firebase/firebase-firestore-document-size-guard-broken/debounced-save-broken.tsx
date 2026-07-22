import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function debouncedSave(docId: string, editor: any) {
  const docRef = doc(db, 'documents', docId);

  // setDoc with getJSON() directly in the payload — no Blob size guard
  await setDoc(docRef, {
    content: editor.getJSON(),
    savedAt: Date.now(),
  });
}
