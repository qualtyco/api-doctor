import { useEffect, useState } from 'react';
import { useAuth } from '../useAuth';
import { realtimeDb } from '../firebase';
import { subscribeToTasks } from '../realtimeTasks';

export default function TaskPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribeToTasks(realtimeDb, user.uid, setTasks);
  }, [realtimeDb, user?.uid]);

  return <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
