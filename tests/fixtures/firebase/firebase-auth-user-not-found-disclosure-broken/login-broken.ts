import type { AuthError } from 'firebase/auth';

export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    default:
      return 'Authentication failed.';
  }
}

export const messageForAuthError = (error: AuthError) => getAuthErrorMessage(error.code);
