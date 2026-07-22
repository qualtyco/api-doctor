import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setCookie } from 'cookies-next';
import { auth } from '@/lib/firebase';

export async function handleSignUp(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();

  // Has secure: true but missing httpOnly — still accessible to JS
  setCookie('firebase_token', idToken, { secure: true, maxAge: 3600 });

  return userCredential.user;
}
