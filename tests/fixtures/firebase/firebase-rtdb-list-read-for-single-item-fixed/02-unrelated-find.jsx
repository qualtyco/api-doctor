// Adversarial: a list subscription and a .find() both exist, but the find
// is keyed by something other than the route id param — not the bug pattern.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { realtimeDb } from '../firebase';
import { subscribeToTask } from '../realtimeTasks';
import { subscribeToCategories } from '../realtimeCategories';

export default function TaskEditPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [categories, setCategories] = useState([]);
  const selectedCategory = 'school';

  useEffect(() => {
    return subscribeToTask(realtimeDb, taskId, setTask);
  }, [realtimeDb, taskId]);

  useEffect(() => {
    return subscribeToCategories(realtimeDb, setCategories);
  }, [realtimeDb]);

  const category = categories.find((c) => c.name === selectedCategory);

  return <div>{task?.title} — {category?.label}</div>;
}
