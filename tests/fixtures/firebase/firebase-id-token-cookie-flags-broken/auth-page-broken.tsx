import { signInWithEmailAndPassword } from 'firebase/auth';
import { setCookie } from 'cookies-next';
import { auth } from '@/lib/firebase';

export async function handleSignIn(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();

    // Missing httpOnly — token readable by JS on the page
    setCookie('token', token, { maxAge: 60 * 60 * 24 });

    return { success: true };
  } catch (error) {
    console.error('Sign-in failed:', error);
    return { success: false };
  }
}
