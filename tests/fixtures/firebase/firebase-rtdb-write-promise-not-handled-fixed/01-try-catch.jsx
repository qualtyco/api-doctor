import { ref, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { realtimeDb } from '../firebase';

export default function TaskEditPage({ userId, taskId, task, setError }) {
  const navigate = useNavigate();

  async function handleSave() {
    try {
      await update(ref(realtimeDb, `users/${userId}/tasks/${taskId}`), task);
      navigate('/tasks');
    } catch (err) {
      setError(err.message);
    }
  }

  return <button onClick={handleSave}>Save</button>;
}
