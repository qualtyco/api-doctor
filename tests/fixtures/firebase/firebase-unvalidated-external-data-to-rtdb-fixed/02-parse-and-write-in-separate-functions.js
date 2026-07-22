// Adversarial: both JSON.parse and a database write exist in this file, but
// in unrelated functions — the parsed config never reaches the write.
import { set, ref } from 'firebase/database';

export function loadFeatureFlags(rawConfig) {
  return JSON.parse(rawConfig);
}

export async function markTaskComplete(realtimeDb, userId, taskId) {
  await set(ref(realtimeDb, `users/${userId}/tasks/${taskId}/completed`), true);
}
