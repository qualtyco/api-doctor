import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createFolder(userId: string, folderName: string) {
  const folderRef = doc(db, 'folders', `${userId}_${folderName}`);

  await setDoc(folderRef, {
    name: folderName,
    owner: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
