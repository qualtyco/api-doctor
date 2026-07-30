import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

// A bare reference is not a call — signOut must not be recorded from this line.
export const endSession = auth.signOut;

// An aliased resource loses the client root — currentUser.reload must not be recorded.
const user = auth.currentUser;

export async function refreshProfile() {
  await user?.reload();
}

// Right shape, wrong root — onAuthStateChanged on a plain object must not be recorded.
const localAuth = { onAuthStateChanged: (cb: (u: null) => void) => cb(null) };

export function watchOffline() {
  return localAuth.onAuthStateChanged(() => {});
}

// A modular free function has no client root — structurally invisible to
// coverage (never `used`, never an unknown SDK call).
export async function endSessionModular() {
  await signOut(auth);
}
