import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Adversarial: no confirmPassword field at all — simple sign-up form, should NOT flag
export async function quickSignUp(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}
