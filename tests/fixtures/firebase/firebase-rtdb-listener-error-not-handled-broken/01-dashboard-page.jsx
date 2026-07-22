import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useAuth } from '../useAuth';
import { realtimeDb } from '../firebase';

export default function DashboardPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    const tasksRef = ref(realtimeDb, `users/${user.uid}/tasks`);
    return onValue(tasksRef, (snapshot) => setTasks(Object.values(snapshot.val() ?? {})));
  }, [realtimeDb, user?.uid]);

  return <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
