import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleGoogleSignIn() {
    setError('');
    setSubmitting(true);
    await signInWithPopup(auth, googleProvider);
    navigate('/dashboard');
  }

  return (
    <button onClick={handleGoogleSignIn} disabled={submitting}>
      {submitting ? 'Signing in...' : 'Sign in with Google'}
    </button>
  );
}
