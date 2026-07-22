import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function saveDocument(docId: string, editor: any) {
  const docRef = doc(db, 'documents', docId);

  // No size check — base64 images can push this over 1 MiB
  await updateDoc(docRef, {
    content: editor.getJSON(),
    updatedAt: Date.now(),
  });
}
