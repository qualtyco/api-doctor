// Adversarial: Promise.all over a .map() that calls set(), which looks like
// the same batching shape — but each set() targets an existing, already-known
// path (no push()-generated key), so there is no key-generation race to fix.
import { ref, set } from 'firebase/database';

export async function markTasksComplete(realtimeDb: any, userId: string, taskIds: string[]) {
  await Promise.all(
    taskIds.map((taskId) => set(ref(realtimeDb, `users/${userId}/tasks/${taskId}/completed`), true)),
  );
}
