import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createFolder(userId: string, folderName: string) {
  const folderRef = doc(db, 'folders', `${userId}_${folderName}`);

  await setDoc(folderRef, {
    name: folderName,
    owner: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
