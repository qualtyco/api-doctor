import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Adversarial: setDoc (not updateDoc) with spread — full document write, not array field update
// This rule only flags updateDoc, so this should NOT fire.
export async function initializeUserDoc(userId: string, existingItems: string[]) {
  await setDoc(doc(db, 'users', userId), {
    items: [...existingItems, 'default-item'],
    createdAt: Date.now(),
  });
}
