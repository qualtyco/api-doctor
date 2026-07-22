import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function handleForgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    // Intentionally not distinguishing errors — show same message regardless
    console.error('Password reset error (internal):', error.code);
  }
  // Always show the same message to prevent email enumeration
  return { submitted: true, message: 'If that email exists, a reset link has been sent.' };
}
