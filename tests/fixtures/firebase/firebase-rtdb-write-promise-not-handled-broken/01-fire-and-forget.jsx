import { ref, set } from 'firebase/database';
import { realtimeDb } from '../firebase';

export default function DashboardPage({ userId, taskId }) {
  function handleToggleComplete() {
    // No await, no .catch — a rejected write is silently dropped.
    set(ref(realtimeDb, `users/${userId}/tasks/${taskId}/completed`), true);
  }

  return <button onClick={handleToggleComplete}>Mark complete</button>;
}
