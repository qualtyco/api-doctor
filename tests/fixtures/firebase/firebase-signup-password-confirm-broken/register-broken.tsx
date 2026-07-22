import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
}

export async function registerUser({ email, password, confirmPassword }: RegisterData) {
  // confirmPassword is accepted as parameter but never validated
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}
