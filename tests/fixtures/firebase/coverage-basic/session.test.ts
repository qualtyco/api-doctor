// Test files are excluded from coverage — onIdTokenChanged must not be recorded.
import { getAuth } from 'firebase/auth';

const auth = getAuth();

it('watches token refreshes', () => {
  auth.onIdTokenChanged(() => {});
});

declare function it(name: string, fn: () => void): void;
