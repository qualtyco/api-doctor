import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function handleForgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { submitted: true };
  } catch (error: any) {
    // Discloses whether the email exists — enables enumeration
    if (error.code === 'auth/user-not-found') {
      return { error: 'No account found with this email address' };
    }
    return { error: 'Something went wrong' };
  }
}
