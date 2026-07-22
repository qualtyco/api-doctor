// Adversarial: not awaited and no try/catch in this function — but the
// promise is returned directly, so the caller receives and can handle it.
import { ref, set } from 'firebase/database';

export function addTask(realtimeDb: any, userId: string, task: any) {
  return set(ref(realtimeDb, `users/${userId}/tasks/${task.id}`), task);
}
