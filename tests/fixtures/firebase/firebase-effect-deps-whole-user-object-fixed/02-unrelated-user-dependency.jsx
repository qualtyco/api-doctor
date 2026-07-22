// Adversarial: the whole `user` object is a dependency, which looks like the
// same suspicious shape — but this effect never reads user.uid, so a token
// refresh re-running it isn't the RTDB-listener-churn bug.
import { useEffect } from 'react';
import { useAuth } from '../useAuth';
import { trackPageView } from '../analytics';

export default function ProfilePage() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    trackPageView('profile', { displayName: user.displayName });
  }, [user]);

  return <div>Profile</div>;
}
