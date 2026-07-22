import { signInWithEmailAndPassword } from 'firebase/auth';
import Cookies from 'js-cookie';
import { auth } from '@/lib/firebase';

// js-cookie runs client-side — it can never set httpOnly, so the token is
// always readable by page JavaScript. Should flag.
export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();
  Cookies.set('auth_token', idToken, { expires: 1 });
  return credential.user;
}
