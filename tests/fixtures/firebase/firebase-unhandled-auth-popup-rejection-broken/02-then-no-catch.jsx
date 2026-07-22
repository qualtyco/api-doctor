import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function GoogleSignInButton({ navigate }) {
  function handleClick() {
    signInWithPopup(auth, googleProvider).then(() => navigate('/dashboard'));
  }

  return <button onClick={handleClick}>Continue with Google</button>;
}
