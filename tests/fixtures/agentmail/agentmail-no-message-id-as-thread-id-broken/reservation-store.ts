// Dinner-reservation shape with `||` instead of `??` — same type confusion.
import { AgentMailClient } from 'agentmail';
import { saveReservation } from './store.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function requestReservation(inboxId: string, restaurant: string): Promise<void> {
  const sent = await agentmail.inboxes.messages.send(inboxId, {
    to: [restaurant],
    subject: 'Reservation request',
    text: 'Table for two at 7pm, please.',
  });
  await saveReservation({
    restaurant,
    thread: sent.threadId || sent.messageId, // BUG: stores a message ID as a thread
  });
}
