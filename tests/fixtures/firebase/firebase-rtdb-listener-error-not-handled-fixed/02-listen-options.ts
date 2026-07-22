// Adversarial: the 3rd argument is a ListenOptions object, not an error
// callback — still a deliberate 3-argument call, not a dropped error path.
import { onValue, ref } from 'firebase/database';

export function readTaskOnce(realtimeDb: any, userId: string, taskId: string, setTask: (v: any) => void) {
  const taskRef = ref(realtimeDb, `users/${userId}/tasks/${taskId}`);
  return onValue(taskRef, (snapshot) => setTask(snapshot.val()), { onlyOnce: true });
}
