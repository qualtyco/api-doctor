// Adversarial: no try/catch and not awaited, but the rejection is still
// handled via a chained .catch().
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function GoogleSignInButton({ navigate, setError }) {
  function handleClick() {
    signInWithPopup(auth, googleProvider)
      .then(() => navigate('/dashboard'))
      .catch((err) => setError(err.message));
  }

  return <button onClick={handleClick}>Continue with Google</button>;
}
