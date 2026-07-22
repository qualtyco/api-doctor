// Note-taker shape: reminder fan-out drains the queue back-to-back.
import { AgentMailClient } from 'agentmail';
import { reminderQueue } from './reminders.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendReminders(inboxId: string): Promise<void> {
  while (reminderQueue.length > 0) {
    const reminder = reminderQueue.shift()!;
    await agentmail.inboxes.messages.send(inboxId, {
      to: [reminder.email],
      subject: `Reminder: ${reminder.title}`,
      text: reminder.body,
    });
  }
}
