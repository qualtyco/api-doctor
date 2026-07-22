import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { realtimeDb } from '../firebase';
import { subscribeToTasks } from '../realtimeTasks';

export default function TaskEditPage() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    return subscribeToTasks(realtimeDb, user.uid, setTasks);
  }, [realtimeDb, user]);

  const task = tasks.find((item) => item.id === taskId);

  if (!task) return <p>Task not found</p>;
  return <div>{task.title}</div>;
}
