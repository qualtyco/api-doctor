import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function saveSettings(font: string) {
  const uid = 'test-user-id';
  await setDoc(doc(db, 'users', uid), { font }, { merge: true });
}
