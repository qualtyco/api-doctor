// Adversarial: validated with a zod schema (schema.parse) between the external
// parse and the write — should NOT flag.
import { set, ref } from 'firebase/database';
import { z } from 'zod';

const taskSchema = z.object({
  title: z.string(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function importTasks(realtimeDb, userId, rawResponse) {
  const tasks = JSON.parse(rawResponse);
  const parsed = tasks.map((task) => taskSchema.parse(task));

  for (const task of parsed) {
    await set(ref(realtimeDb, `users/${userId}/tasks/${task.title}`), task);
  }
}
