import { set, ref } from 'firebase/database';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export async function importSyllabusTasks(realtimeDb, userId, syllabusText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ prompt: syllabusText }),
  });
  const data = await response.json();
  const tasks = JSON.parse(data.choices[0].message.content);

  const validTasks = tasks.filter((task) => {
    return typeof task.title === 'string' && DATE_FORMAT.test(task.dueDate);
  });

  for (const task of validTasks) {
    await set(ref(realtimeDb, `users/${userId}/tasks/${task.id}`), task);
  }
}
