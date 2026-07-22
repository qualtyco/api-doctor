import { set, ref } from 'firebase/database';

export async function importSyllabusTasks(realtimeDb, userId, syllabusText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ prompt: syllabusText }),
  });
  const data = await response.json();
  const tasks = JSON.parse(data.choices[0].message.content);

  // No shape/value check on tasks before writing — title/dueDate/category
  // are assumed to be present and well-formed.
  for (const task of tasks) {
    await set(ref(realtimeDb, `users/${userId}/tasks/${task.id}`), task);
  }
}
