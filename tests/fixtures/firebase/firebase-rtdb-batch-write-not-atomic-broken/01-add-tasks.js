import { push, ref, set } from 'firebase/database';

function tasksRef(realtimeDb, userId) {
  return ref(realtimeDb, `users/${userId}/tasks`);
}

export async function addTasks(realtimeDb, userId, tasks) {
  const taskWrites = tasks.map((task) => {
    const newTaskRef = push(tasksRef(realtimeDb, userId));
    return set(newTaskRef, task);
  });
  await Promise.all(taskWrites);
}
