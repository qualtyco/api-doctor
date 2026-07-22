import { push, ref, update } from 'firebase/database';

function tasksRef(realtimeDb, userId) {
  return ref(realtimeDb, `users/${userId}/tasks`);
}

export async function addTasks(realtimeDb, userId, tasks) {
  const updates = {};
  tasks.forEach((task) => {
    const key = push(tasksRef(realtimeDb, userId)).key;
    updates[key] = task;
  });
  return update(tasksRef(realtimeDb, userId), updates);
}
