// Regression: a data-flow rule flags what happens to the provider's DATA (a
// Firebase ID token stored without cookie flags) via a call whose callee is
// someone else's. Foreign attribution of `setCookie` itself proves nothing
// about the finding — a bare call carries no receiver claim to refute.
import { getAuth } from 'firebase/auth';
import { setCookie } from './cookies.js';

export async function persistSession() {
  const auth = getAuth();
  const idToken = await auth.currentUser!.getIdToken();
  setCookie('token', idToken, { maxAge: 60 * 60 * 24 * 5 });
}
