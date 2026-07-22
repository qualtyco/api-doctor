import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function addFolder(userId: string, newFolderId: string) {
  const userDocRef = doc(db, 'userCollections', userId);
  const snap = await getDoc(userDocRef);
  const existingFolders: string[] = snap.data()?.folders ?? [];

  // Non-atomic read-modify-write — loses concurrent updates
  await updateDoc(userDocRef, {
    folders: [...existingFolders, newFolderId],
  });
}
