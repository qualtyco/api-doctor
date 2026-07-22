import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useAuth } from '../useAuth';
import { realtimeDb } from '../firebase';

export default function DashboardPage() {
  const { user } = useAuth();
  const [fatigueEntries, setFatigueEntries] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    const entriesRef = ref(realtimeDb, `users/${user.uid}/fatigue`);
    return onValue(entriesRef, (snapshot) => setFatigueEntries(Object.values(snapshot.val() ?? {})));
  }, [realtimeDb, user]);

  return <div>{fatigueEntries.length} entries</div>;
}
