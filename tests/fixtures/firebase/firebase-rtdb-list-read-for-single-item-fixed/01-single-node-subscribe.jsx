import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { realtimeDb } from '../firebase';
import { subscribeToTask } from '../realtimeTasks';

export default function TaskEditPage() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState(null);

  useEffect(() => {
    return subscribeToTask(realtimeDb, user.uid, taskId, setTask);
  }, [realtimeDb, user, taskId]);

  if (!task) return <p>Task not found</p>;
  return <div>{task.title}</div>;
}
