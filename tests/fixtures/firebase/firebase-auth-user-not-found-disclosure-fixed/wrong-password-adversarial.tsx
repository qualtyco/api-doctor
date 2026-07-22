// Adversarial: checks auth/wrong-password, not auth/user-not-found — should NOT flag
export function getAuthErrorMessage(code: string): string {
  if (code === 'auth/wrong-password') {
    return 'Incorrect password. Please try again.';
  }
  return 'Authentication failed. Please try again.';
}
