import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function addFolder(userId: string, newFolderId: string) {
  const userDocRef = doc(db, 'userCollections', userId);
  await updateDoc(userDocRef, { folders: arrayUnion(newFolderId) });
}

export async function removeFolder(userId: string, folderId: string) {
  const userDocRef = doc(db, 'userCollections', userId);
  await updateDoc(userDocRef, { folders: arrayRemove(folderId) });
}
