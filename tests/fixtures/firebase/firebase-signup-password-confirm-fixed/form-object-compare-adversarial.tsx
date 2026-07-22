import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface SignUpForm {
  email: string;
  password: string;
  confirmPassword: string;
}

// Adversarial: the comparison uses member access (form.confirmPassword),
// not bare identifiers — should NOT flag.
export async function handleSignUp(form: SignUpForm) {
  if (form.password !== form.confirmPassword) {
    throw new Error('Passwords do not match');
  }
  const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
  return credential.user;
}
