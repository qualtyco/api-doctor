import { ref, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { realtimeDb } from '../firebase';

export default function TaskEditPage({ userId, taskId, task }) {
  const navigate = useNavigate();

  async function handleSave() {
    // Awaited, but with no try/catch: a rejected write still navigates away
    // as if the edit succeeded.
    await update(ref(realtimeDb, `users/${userId}/tasks/${taskId}`), task);
    navigate('/tasks');
  }

  return <button onClick={handleSave}>Save</button>;
}
