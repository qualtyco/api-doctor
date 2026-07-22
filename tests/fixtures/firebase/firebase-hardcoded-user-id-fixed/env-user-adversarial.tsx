import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Adversarial: userId from env (admin service account), not hardcoded user data
export async function getAdminDoc() {
  const userId = process.env.ADMIN_USER_ID;
  if (!userId) throw new Error('ADMIN_USER_ID not set');
  const docRef = doc(db, 'admins', userId);
  return getDoc(docRef);
}
