import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function saveDocument(docId: string, editor: any, setSaveStatus: (s: string) => void) {
  const json = editor.getJSON();
  const payload = JSON.stringify(json);

  if (new Blob([payload]).size > 900_000) {
    setSaveStatus('Document too large to save ⚠️');
    return;
  }

  const docRef = doc(db, 'documents', docId);
  await updateDoc(docRef, { content: json, updatedAt: Date.now() });
  setSaveStatus('Saved ✅');
}
